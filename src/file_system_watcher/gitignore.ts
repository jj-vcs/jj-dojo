/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

interface ParsedRule {
  readonly regexSource: string;
  readonly negated: boolean;
  readonly onlyDir: boolean;
  readonly topLevelLiteralCandidate: string | undefined;
}

interface CompiledBatch {
  readonly regex: RegExp;
  readonly negated: boolean;
}

const POSIX_CLASSES: ReadonlyMap<string, string> = new Map<string, string>([
  ['alnum', 'a-zA-Z0-9'],
  ['alpha', 'a-zA-Z'],
  ['blank', ' \\t'],
  ['cntrl', '\\x00-\\x1F\\x7F'],
  ['digit', '0-9'],
  ['graph', '\\x21-\\x7E'],
  ['lower', 'a-z'],
  ['print', '\\x20-\\x7E'],
  ['punct', '!"#$%&\'()*+,\\-./:;<=>?@[\\\\\\]^_`{|}~'],
  ['space', ' \\t\\r\\n\\v\\f'],
  ['upper', 'A-Z'],
  ['xdigit', '0-9a-fA-F'],
]);

/**
 * Safe single-segment directory name without glob metacharacters or VCS names,
 * suitable for passing as a literal path to `@parcel/watcher` `opts.ignore`.
 */
const SAFE_NATIVE_IGNORE_SEGMENT = /^(?!\.{1,2}$)[A-Za-z0-9._ -]+$/;

/**
 * Pure, zero-dependency matcher modeling the effective contents of one or more
 * chained `.gitignore` files, matching Jujutsu's `GitIgnoreFile` semantics.
 *
 * Callers must check ancestor directories top-down with `matchesDir()` before
 * checking a child path, as files inside an ignored directory remain ignored
 * regardless of inner negation rules.
 */
export class GitIgnoreFile {
  private constructor(
    private readonly parent: GitIgnoreFile | null,
    private readonly prefix: string,
    private readonly fileBatches: readonly CompiledBatch[],
    private readonly dirBatches: readonly CompiledBatch[],
  ) {}

  static empty(): GitIgnoreFile {
    return new GitIgnoreFile(null, '', [], []);
  }

  /**
   * Concatenates new `.gitignore` content rooted at `prefix` (a `/`-separated
   * workspace-relative directory path, or `''` for the workspace root).
   */
  chain(prefix: string, content: string): GitIgnoreFile {
    const normalizedPrefix = normalizeRepoPath(prefix);
    const rules = parseGitIgnoreRules(content);
    if (rules.length === 0) {
      return this;
    }

    const fileBatches = compileReverseBatches(
      rules.filter((rule) => !rule.onlyDir),
    );
    const dirBatches = compileReverseBatches(rules);
    if (fileBatches.length === 0 && dirBatches.length === 0) {
      return this;
    }

    const effectiveParent = this.isEmpty() ? null : this;
    return new GitIgnoreFile(
      effectiveParent,
      normalizedPrefix,
      fileBatches,
      dirBatches,
    );
  }

  /**
   * Performs exact matching for a workspace-relative POSIX file path against
   * the last applicable rule in this chain. Does not walk parent directories.
   */
  matchesFile(path: string): boolean {
    return this.matches(path, false);
  }

  /**
   * Performs exact matching for a workspace-relative POSIX directory path
   * against the last applicable rule in this chain. Does not walk parent
   * directories.
   */
  matchesDir(path: string): boolean {
    return this.matches(path, true);
  }

  private isEmpty(): boolean {
    return (
      this.parent === null &&
      this.fileBatches.length === 0 &&
      this.dirBatches.length === 0
    );
  }

  private matches(rawPath: string, isDir: boolean): boolean {
    const path = normalizeRepoPath(rawPath);
    if (path === '') {
      return false;
    }

    const selfDecision = this.matchSingleNode(path, isDir);
    if (selfDecision !== undefined) {
      return selfDecision;
    }
    for (let curr = this.parent; curr !== null; curr = curr.parent) {
      const decision = curr.matchSingleNode(path, isDir);
      if (decision !== undefined) {
        return decision;
      }
    }
    return false;
  }

  private matchSingleNode(path: string, isDir: boolean): boolean | undefined {
    const relPath = stripRepoPrefix(path, this.prefix);
    if (relPath === undefined || relPath === '') {
      return undefined;
    }
    const batches = isDir ? this.dirBatches : this.fileBatches;
    for (const batch of batches) {
      if (batch.regex.test(relPath)) {
        return !batch.negated;
      }
    }
    return undefined;
  }
}

/**
 * Extracts sorted, deduplicated top-level directory names from root
 * `.gitignore` content that are safe to exclude natively in `@parcel/watcher`
 * (plain single-segment names without glob metacharacters that remain ignored
 * as directories after applying all rules in `effectiveRootIgnore`).
 */
export function extractTopLevelIgnoredDirs(
  rootContent: string,
  effectiveRootIgnore?: GitIgnoreFile,
): string[] {
  const rules = parseGitIgnoreRules(rootContent);
  if (rules.length === 0) {
    return [];
  }

  const rootMatcher =
    effectiveRootIgnore ?? GitIgnoreFile.empty().chain('', rootContent);
  const candidates = new Set<string>();
  for (const rule of rules) {
    const candidate = rule.topLevelLiteralCandidate;
    if (
      candidate !== undefined &&
      candidate !== '.jj' &&
      candidate !== '.git' &&
      rootMatcher.matchesDir(candidate)
    ) {
      candidates.add(candidate);
    }
  }
  return Array.from(candidates).sort();
}

function normalizeRepoPath(path: string): string {
  let start = 0;
  let end = path.length;
  while (start < end && path.charCodeAt(start) === 47 /* '/' */) {
    start++;
  }
  while (end > start && path.charCodeAt(end - 1) === 47 /* '/' */) {
    end--;
  }
  return start === 0 && end === path.length ? path : path.slice(start, end);
}

function stripRepoPrefix(path: string, prefix: string): string | undefined {
  if (prefix === '') {
    return path;
  }
  if (
    path.length > prefix.length &&
    path.startsWith(prefix) &&
    path.charCodeAt(prefix.length) === 47 /* '/' */
  ) {
    return path.slice(prefix.length + 1);
  }
  return undefined;
}

/**
 * Compiles consecutive same-polarity rules into combined RegExp batches in
 * reverse order.
 *
 * In a `.gitignore` file, the rule is "last-match-wins." This means that if a
 * file matches multiple patterns in your ignore list, Git will apply the
 * decision of the pattern that appears lowest (most recent) in the file.
 * Reversing the batches allows evaluation to test from lowest to highest and
 * return early on the first match.
 */
function compileReverseBatches(rules: readonly ParsedRule[]): CompiledBatch[] {
  const batches: CompiledBatch[] = [];
  let i = 0;
  while (i < rules.length) {
    const negated = rules[i].negated;
    const sources: string[] = [];
    while (i < rules.length && rules[i].negated === negated) {
      sources.push(rules[i].regexSource);
      i++;
    }

    const validSources = sources.filter((source) => isValidRegex(source));
    if (validSources.length === 0) {
      continue;
    }
    const combined =
      validSources.length === 1
        ? validSources[0]
        : validSources.map((s) => `(?:${s})`).join('|');
    batches.push({
      regex: new RegExp(combined),
      negated,
    });
  }
  batches.reverse();
  return batches;
}

function isValidRegex(source: string): boolean {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}

function parseGitIgnoreRules(content: string): ParsedRule[] {
  const withoutBom = content.startsWith('\uFEFF') ? content.slice(1) : content;
  if (withoutBom === '') {
    return [];
  }

  const rawLines = withoutBom.split('\n');
  const rules: ParsedRule[] = [];
  for (let rawLine of rawLines) {
    if (rawLine.endsWith('\r')) {
      rawLine = rawLine.slice(0, -1);
    }
    const parsed = parseGitIgnoreLine(rawLine);
    if (parsed !== undefined) {
      rules.push(parsed);
    }
  }
  return rules;
}

function parseGitIgnoreLine(rawLine: string): ParsedRule | undefined {
  if (rawLine === '' || rawLine.startsWith('#')) {
    return undefined;
  }

  // Strip unescaped trailing ASCII spaces and reject lines ending with a
  // dangling escape backslash (`\`).
  let escaped = false;
  let trimmedEnd = 0;
  for (let i = 0; i < rawLine.length; i++) {
    const ch = rawLine[i];
    if (escaped) {
      escaped = false;
      trimmedEnd = i + 1;
    } else if (ch === '\\') {
      escaped = true;
    } else if (ch !== ' ') {
      trimmedEnd = i + 1;
    }
  }
  if (escaped) {
    return undefined;
  }

  let line = rawLine.slice(0, trimmedEnd);
  if (line === '') {
    return undefined;
  }

  let negated = false;
  if (line.startsWith('!')) {
    negated = true;
    line = line.slice(1);
    if (line === '') {
      return undefined;
    }
  }

  let onlyDir = false;
  if (line.endsWith('/')) {
    onlyDir = true;
    line = line.slice(0, -1);
    if (line === '') {
      return undefined;
    }
  }

  const anchored = line.includes('/');
  const pattern = line.startsWith('/') ? line.slice(1) : line;
  if (pattern === '') {
    return undefined;
  }

  const regexSource = compileGlobToRegexSource(pattern, anchored);
  if (regexSource === undefined) {
    return undefined;
  }

  const topLevelLiteralCandidate =
    !negated &&
    !pattern.includes('/') &&
    !/[*?[\\]/.test(pattern) &&
    SAFE_NATIVE_IGNORE_SEGMENT.test(pattern)
      ? pattern
      : undefined;

  return {
    regexSource,
    negated,
    onlyDir,
    topLevelLiteralCandidate,
  };
}

function compileGlobToRegexSource(
  pattern: string,
  anchored: boolean,
): string | undefined {
  if (pattern === '**' || /^\*\*(?:\/\*\*)+$/.test(pattern)) {
    return '^.+$';
  }

  let rest = pattern;
  let hasLeadingDoubleStar = false;
  while (rest.startsWith('**/')) {
    hasLeadingDoubleStar = true;
    rest = rest.slice(3);
  }
  if (rest === '' || rest === '**') {
    return '^.+$';
  }

  const prefix = hasLeadingDoubleStar
    ? '^(?:.+/)?'
    : anchored
      ? '^'
      : '(?:^|/)';

  let body = '';
  let i = 0;
  while (i < rest.length) {
    const ch = rest[i];
    if (ch === '/') {
      const remaining = rest.slice(i);
      if (/^(?:\/\*\*)+$/.test(remaining)) {
        body += '/.+';
        i = rest.length;
        break;
      }
      if (remaining.startsWith('/**/')) {
        while (rest.slice(i, i + 4) === '/**/') {
          i += 3;
        }
        i += 1;
        body += '/(?:.+/)?';
        continue;
      }
      body += '/';
      i++;
      continue;
    }

    if (ch === '*') {
      while (rest[i + 1] === '*') {
        i++;
      }
      body += '[^/]*';
      i++;
      continue;
    }

    if (ch === '?') {
      body += '[^/]';
      i++;
      continue;
    }

    if (ch === '\\') {
      i++;
      if (i >= rest.length) {
        return undefined;
      }
      body += escapeRegexLiteralChar(rest[i]);
      i++;
      continue;
    }

    if (ch === '[') {
      const bracket = parseBracketClass(rest, i);
      if (bracket === undefined) {
        return undefined;
      }
      body += bracket.source;
      i = bracket.nextIndex;
      continue;
    }

    body += escapeRegexLiteralChar(ch);
    i++;
  }

  return `${prefix}${body}$`;
}

function parseBracketClass(
  pattern: string,
  startIndex: number,
): {source: string; nextIndex: number} | undefined {
  let i = startIndex + 1;
  if (i >= pattern.length) {
    return {source: '\\[', nextIndex: startIndex + 1};
  }

  let negatedClass = false;
  if (pattern[i] === '!' || pattern[i] === '^') {
    negatedClass = true;
    i++;
  }

  const bodyStart = i;
  let innerSource = '';
  let closed = false;

  while (i < pattern.length) {
    if (pattern[i] === ']' && i > bodyStart) {
      closed = true;
      i++;
      break;
    }

    if (pattern[i] === '[' && pattern[i + 1] === ':') {
      const closeBracket = pattern.indexOf(']', i + 2);
      if (closeBracket === -1) {
        return {source: '\\[', nextIndex: startIndex + 1};
      }
      if (closeBracket - i >= 3 && pattern[closeBracket - 1] === ':') {
        const className = pattern.slice(i + 2, closeBracket - 1);
        const mapped = POSIX_CLASSES.get(className);
        if (mapped === undefined) {
          return undefined;
        }
        innerSource += mapped;
        i = closeBracket + 1;
        continue;
      }
    }

    let startChar: string;
    let afterStart: number;
    if (pattern[i] === '\\') {
      if (i + 1 >= pattern.length) {
        return {source: '\\[', nextIndex: startIndex + 1};
      }
      startChar = pattern[i + 1];
      afterStart = i + 2;
    } else {
      startChar = pattern[i];
      afterStart = i + 1;
    }

    if (
      afterStart + 1 < pattern.length &&
      pattern[afterStart] === '-' &&
      pattern[afterStart + 1] !== ']'
    ) {
      let endChar: string;
      let afterRange: number;
      if (pattern[afterStart + 1] === '\\') {
        if (afterStart + 2 >= pattern.length) {
          return {source: '\\[', nextIndex: startIndex + 1};
        }
        endChar = pattern[afterStart + 2];
        afterRange = afterStart + 3;
      } else {
        endChar = pattern[afterStart + 1];
        afterRange = afterStart + 2;
      }

      if (startChar.charCodeAt(0) <= endChar.charCodeAt(0)) {
        innerSource += `${escapeCharClassChar(startChar)}-${escapeCharClassChar(endChar)}`;
      }
      i = afterRange;
      continue;
    }

    if (startChar !== '/') {
      innerSource += escapeCharClassChar(startChar);
    }
    i = afterStart;
  }

  if (!closed) {
    return {source: '\\[', nextIndex: startIndex + 1};
  }

  if (negatedClass) {
    return {source: `[^/${innerSource}]`, nextIndex: i};
  }
  if (innerSource === '') {
    return {source: '(?!x)x', nextIndex: i};
  }
  return {source: `(?!\\/)[${innerSource}]`, nextIndex: i};
}

function escapeRegexLiteralChar(ch: string): string {
  return /[\\^$.|+?*()[\]{}]/.test(ch) ? `\\${ch}` : ch;
}

function escapeCharClassChar(ch: string): string {
  return /[\\\]^-]/.test(ch) ? `\\${ch}` : ch;
}
