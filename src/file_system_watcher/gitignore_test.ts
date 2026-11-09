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

import {GitIgnoreFile, extractTopLevelIgnoredDirs} from './gitignore';

function matches(content: string, candidatePath: string): boolean {
  const file = GitIgnoreFile.empty().chain('', content);
  if (candidatePath.endsWith('/')) {
    return file.matchesDir(candidatePath.slice(0, -1));
  }
  return file.matchesFile(candidatePath);
}

describe('GitIgnoreFile', () => {
  it('matches nothing when empty or chained with empty content', () => {
    const empty = GitIgnoreFile.empty();
    expect(empty.matchesFile('foo')).toBe(false);
    expect(empty.matchesDir('foo')).toBe(false);

    const chainedEmpty = empty.chain('dir', '');
    expect(chainedEmpty).toBe(empty);
    expect(chainedEmpty.matchesFile('dir/foo')).toBe(false);
  });

  it('matches unanchored literal patterns at any depth under prefix', () => {
    const root = GitIgnoreFile.empty().chain('', 'foo\n');
    expect(root.matchesFile('foo')).toBe(true);
    expect(root.matchesFile('dir/foo')).toBe(true);
    expect(root.matchesFile('dir/subdir/foo')).toBe(true);
    expect(root.matchesFile('food')).toBe(false);
    expect(root.matchesFile('dir/food')).toBe(false);

    const prefixed = GitIgnoreFile.empty().chain('dir', 'foo\n');
    expect(prefixed.matchesFile('foo')).toBe(false);
    expect(prefixed.matchesFile('dir/foo')).toBe(true);
    expect(prefixed.matchesFile('dir/subdir/foo')).toBe(true);
  });

  it('does not match the prefix directory itself when pattern equals prefix', () => {
    const file = GitIgnoreFile.empty().chain('dir', 'dir\n');
    expect(file.matchesDir('dir')).toBe(false);
    expect(file.matchesFile('dir/dir')).toBe(true);
    expect(file.matchesFile('dir/foo')).toBe(false);
  });

  it('anchors patterns with leading or internal slashes to the prefix', () => {
    const rooted = GitIgnoreFile.empty().chain('', '/foo\n');
    expect(rooted.matchesFile('foo')).toBe(true);
    expect(rooted.matchesFile('dir/foo')).toBe(false);

    const rootedWithPrefix = GitIgnoreFile.empty().chain('dir', '/foo\n');
    expect(rootedWithPrefix.matchesFile('dir/foo')).toBe(true);
    expect(rootedWithPrefix.matchesFile('dir/subdir/foo')).toBe(false);

    const deep = GitIgnoreFile.empty().chain('', '/dir1/dir2/dir3\n');
    expect(deep.matchesFile('foo')).toBe(false);
    expect(deep.matchesDir('dir1')).toBe(false);
    expect(deep.matchesDir('dir1/dir2')).toBe(false);
    expect(deep.matchesDir('dir1/dir2/dir3')).toBe(true);
    expect(deep.matchesDir('dir1/dir2/dir3/dir4')).toBe(false);

    const middleSlash = GitIgnoreFile.empty().chain('', 'sub/foo\n');
    expect(middleSlash.matchesFile('sub/foo')).toBe(true);
    expect(middleSlash.matchesFile('nested/sub/foo')).toBe(false);
  });

  it('chains nested prefixes relative to workspace root', () => {
    const file = GitIgnoreFile.empty()
      .chain('', '/dummy\n')
      .chain('dir1', '/dummy\n')
      .chain('dir1/dir2', '/dir3\n');
    expect(file.matchesFile('foo')).toBe(false);
    expect(file.matchesDir('dir1')).toBe(false);
    expect(file.matchesDir('dir1/dir2')).toBe(false);
    expect(file.matchesDir('dir1/dir2/dir3')).toBe(true);
    expect(file.matchesDir('dir1/dir2/dir3/dir4')).toBe(false);
  });

  it('restricts trailing-slash rules to directories only', () => {
    const file = GitIgnoreFile.empty().chain('', '/dir/\n');
    expect(file.matchesFile('dir')).toBe(false);
    expect(file.matchesDir('dir')).toBe(true);
    expect(file.matchesFile('dir/subdir')).toBe(false);

    const slashAfterGlob = GitIgnoreFile.empty().chain('', '/*/\n');
    expect(slashAfterGlob.matchesFile('foo')).toBe(false);
    expect(slashAfterGlob.matchesDir('foo')).toBe(true);
    expect(slashAfterGlob.matchesFile('foo/bar')).toBe(false);
    expect(slashAfterGlob.matchesDir('foo/bar')).toBe(false);
  });

  it('handles comments, escaped leading symbols, and backslash escapes', () => {
    expect(matches('#comment\n', '#comment')).toBe(false);
    expect(matches('\\#comment\n', '#comment')).toBe(true);
    expect(matches('\\*\n', '*')).toBe(true);
    expect(matches('\\*\n', 'foo')).toBe(false);
    expect(matches('\\!\n', '!')).toBe(true);
    expect(matches('\\!important\n', '!important')).toBe(true);
    expect(matches('\\?\n', '?')).toBe(true);
    expect(matches('\\?\n', 'x')).toBe(false);
    // Escaped ASCII letters match literally rather than JS RegExp escapes.
    expect(matches('\\w\n', 'w')).toBe(true);
    expect(matches('\\w\n', 'a')).toBe(false);
    expect(matches('\\d\n', 'd')).toBe(true);
    expect(matches('\\d\n', '5')).toBe(false);
    expect(matches('\\\\\n', '\\')).toBe(true);
    // Dangling trailing backslash is invalid and ignored.
    expect(matches('\\\n', '\\')).toBe(false);
    expect(matches('foo\\\n', 'foo')).toBe(false);
    // Backslashes in paths do not match '/' separators.
    expect(matches('/foo/bar', 'foo\\bar')).toBe(false);
    expect(matches('/foo/bar', 'foo/bar\\')).toBe(false);
    expect(matches('/foo/bar/', 'foo\\bar/')).toBe(false);
  });

  it('strips unescaped trailing spaces and single CRLF carriage returns', () => {
    expect(matches(' \n', ' ')).toBe(false);
    expect(matches('\\ \n', ' ')).toBe(true);
    expect(matches('\\\\ \n', ' ')).toBe(false);
    expect(matches('\\\\ \n', '\\')).toBe(true);
    expect(matches(' a\n', ' a')).toBe(true);
    expect(matches('a b\n', 'a b')).toBe(true);
    expect(matches('a b \n', 'a b')).toBe(true);
    expect(matches('a b \n', 'a b ')).toBe(false);
    expect(matches('a b\\ \\ \n', 'a b  ')).toBe(true);
    expect(matches('a b\\ \\  \n', 'a b  ')).toBe(true);

    expect(matches('a\r\n', 'a')).toBe(true);
    expect(matches('a\r\n', 'a\r')).toBe(false);
    expect(matches('a\r\r\n', 'a\r')).toBe(true);
    expect(matches('a\r\r\n', 'a')).toBe(false);
    expect(matches('\ra\n', '\ra')).toBe(true);
    expect(matches('\ra\n', 'a')).toBe(false);
  });

  it('strips UTF-8 BOM only at the beginning of the file', () => {
    expect(matches('\uFEFFfoo\n', 'foo')).toBe(true);
    expect(matches('\n\uFEFFfoo\n', 'foo')).toBe(false);
  });

  it('matches single-segment globs and sanitized character classes', () => {
    expect(matches('*.o\n', 'foo')).toBe(false);
    expect(matches('*.o\n', 'foo.o')).toBe(true);
    expect(matches('foo.?\n', 'foo')).toBe(false);
    expect(matches('foo.?\n', 'foo.')).toBe(false);
    expect(matches('foo.?\n', 'foo.o')).toBe(true);
    expect(matches('foo?bar\n', 'foo/bar')).toBe(false);

    expect(matches('foo.[az]\n', 'foo.a')).toBe(true);
    expect(matches('foo.[az]\n', 'foo.g')).toBe(false);
    expect(matches('foo.[a-z]\n', 'foo.g')).toBe(true);
    expect(matches('foo.[0-9a-fA-F]\n', 'foo.E')).toBe(true);
    expect(matches('foo.[0-9a-fA-F]\n', 'foo._')).toBe(false);

    // Negated classes must not match '/'.
    expect(matches('foo[!a-z]bar\n', 'foo0bar')).toBe(true);
    expect(matches('foo[!a-z]bar\n', 'fooabar')).toBe(false);
    expect(matches('foo[!a-z]bar\n', 'foo/bar')).toBe(false);
    expect(matches('foo[^a-z]bar\n', 'foo0bar')).toBe(true);
    expect(matches('foo[^a-z]bar\n', 'foo/bar')).toBe(false);

    // Ranges spanning ASCII 47 ('/') must not match '/'.
    expect(matches('foo[ -~]bar\n', 'foo0bar')).toBe(true);
    expect(matches('foo[ -~]bar\n', 'foo/bar')).toBe(false);

    // Out-of-order ranges and unclosed brackets must not throw.
    expect(matches('foo.[z-a]\n', 'foo.a')).toBe(false);
    expect(matches('foo.[z-ab]\n', 'foo.b')).toBe(true);
    expect(matches('foo[bar\n', 'foo[bar')).toBe(true);
    expect(matches('foo[[:digit:]]\n', 'foo7')).toBe(true);
    expect(matches('foo[[:digit:]]\n', 'fooa')).toBe(false);
    expect(matches('foo[]a]\n', 'foo]')).toBe(true);
    expect(matches('foo[]a]\n', 'fooa')).toBe(true);

    // Object.prototype keys and unknown POSIX classes must be rejected rather
    // than resolving prototype properties or corrupting bracket parsing.
    expect(matches('foo[[:constructor:]]bar\n', 'foocbar')).toBe(false);
    expect(matches('foo[a[:constructor:]]bar\n', 'fooabar')).toBe(false);
    expect(matches('foo[[:__proto__:]]bar\n', 'foopbar')).toBe(false);
    expect(matches('foo[[:toString:]]bar\n', 'footbar')).toBe(false);
    expect(matches('foo[[:unknown:]]bar\n', 'fooubar')).toBe(false);
    expect(matches('foo[[:unknown:]]bar\n', 'foou]bar')).toBe(false);

    // Incomplete `[:` without closing `:]` inside `[...]` must not scan past
    // the closing `]` into a subsequent bracket expression on the same line.
    expect(matches('foo[[:a][[:digit:]]\n', 'foo[7')).toBe(true);
    expect(matches('foo[[:a][[:digit:]]\n', 'foo:7')).toBe(true);
    expect(matches('foo[[:a][[:digit:]]\n', 'fooa7')).toBe(true);
    expect(matches('foo[[:a][[:digit:]]\n', 'foob7')).toBe(false);
    expect(matches('foo[[:]\n', 'foo[')).toBe(true);
    expect(matches('foo[[:]\n', 'foo:')).toBe(true);
  });

  it('supports leading, trailing, internal, and non-directory ** globs', () => {
    const leading = GitIgnoreFile.empty().chain('', '**/foo\n');
    expect(leading.matchesFile('foo')).toBe(true);
    expect(leading.matchesFile('dir1/dir2/foo')).toBe(true);
    expect(leading.matchesFile('foo/file')).toBe(false);

    const leadingWithPrefix = GitIgnoreFile.empty().chain(
      'dir1/dir2',
      '**/foo\n',
    );
    expect(leadingWithPrefix.matchesFile('dir1/dir2/foo')).toBe(true);
    expect(leadingWithPrefix.matchesFile('dir1/dir2/sub1/sub2/foo')).toBe(true);
    expect(leadingWithPrefix.matchesFile('dir1/dir2/bar')).toBe(false);

    expect(matches('abc/**\n', 'abc')).toBe(false);
    expect(matches('abc/**\n', 'abc/file')).toBe(true);
    expect(matches('abc/**\n', 'abc/dir/file')).toBe(true);

    expect(matches('a/**/b\n', 'a/b')).toBe(true);
    expect(matches('a/**/b\n', 'a/x/b')).toBe(true);
    expect(matches('a/**/b\n', 'a/x/y/b')).toBe(true);
    expect(matches('a/**/b\n', 'ax/y/b')).toBe(false);
    expect(matches('a/**/b\n', 'a/x/yb')).toBe(false);
    expect(matches('a/**/b\n', 'z/a/b')).toBe(false);

    // Non-slash-bounded '**' acts as a single-segment wildcard.
    expect(matches('a/x**y/b\n', 'a/b')).toBe(false);
    expect(matches('a/x**y/b\n', 'a/xy/b')).toBe(true);
    expect(matches('a/x**y/b\n', 'a/xzzzy/b')).toBe(true);
    expect(matches('a/x**y/b\n', 'a/x/y/b')).toBe(false);

    const starRoot = GitIgnoreFile.empty().chain('', '*\n');
    expect(starRoot.matchesDir('')).toBe(false);
    expect(starRoot.matchesFile('foo')).toBe(true);
    expect(starRoot.matchesDir('foo')).toBe(true);
    expect(starRoot.matchesFile('foo/bar')).toBe(true);

    const starSubdir = GitIgnoreFile.empty().chain('foo', '*\n');
    expect(starSubdir.matchesFile('foo')).toBe(false);
    expect(starSubdir.matchesDir('foo')).toBe(false);
    expect(starSubdir.matchesFile('foo/bar')).toBe(true);
    expect(starSubdir.matchesFile('bar/baz')).toBe(false);
  });

  it('preserves last-match-wins precedence across negations and chains', () => {
    const file1 = GitIgnoreFile.empty().chain(
      '',
      'foo*\n!foobar*\nfoobarbaz\n',
    );
    expect(file1.matchesFile('foo')).toBe(true);
    expect(file1.matchesFile('foobar')).toBe(false);
    expect(file1.matchesFile('foobarbaz')).toBe(true);
    expect(file1.matchesFile('foobarquux')).toBe(false);

    // Directory-only negation must not un-ignore a matching regular file.
    const dirNegation = GitIgnoreFile.empty().chain('', 'foo*\n!foo*bar/\n');
    expect(dirNegation.matchesFile('fooxbar')).toBe(true);
    expect(dirNegation.matchesDir('fooxbar')).toBe(false);

    // Negative parent dir rule does not override file rule inside it.
    const negParent1 = GitIgnoreFile.empty().chain('', 'foo/bar.*\n!/foo/\n');
    expect(negParent1.matchesDir('foo')).toBe(false);
    expect(negParent1.matchesFile('foo/bar.ext')).toBe(true);

    const negParent2 = GitIgnoreFile.empty().chain('', '!/foo/\nfoo/bar.*\n');
    expect(negParent2.matchesFile('foo/bar.ext')).toBe(true);

    // Chained child .gitignore overrides parent rules within its subtree.
    const chained = GitIgnoreFile.empty()
      .chain('', '*.log\n')
      .chain('keep', '!important.log\n')
      .chain('keep/sub', 'important.log\n');
    expect(chained.matchesFile('root.log')).toBe(true);
    expect(chained.matchesFile('keep/other.log')).toBe(true);
    expect(chained.matchesFile('keep/important.log')).toBe(false);
    expect(chained.matchesFile('keep/sub/important.log')).toBe(true);
  });

  it('matches case-sensitively', () => {
    const file = GitIgnoreFile.empty().chain('', 'Build/\n*.LOG\n');
    expect(file.matchesDir('Build')).toBe(true);
    expect(file.matchesDir('build')).toBe(false);
    expect(file.matchesFile('app.LOG')).toBe(true);
    expect(file.matchesFile('app.log')).toBe(false);
  });
});

describe('extractTopLevelIgnoredDirs', () => {
  it('extracts safe un-negated top-level directory names and excludes globs/negations', () => {
    const content = [
      '# dependencies & outputs',
      'node_modules/',
      '/dist/',
      'build',
      '/out',
      '*.log',
      'bazel-*',
      'nested/cache/',
      '.jj',
      '.git/',
      'kept_dir/',
      '!kept_dir/',
      'negated_by_glob/',
      '!negated_*',
    ].join('\n');

    expect(extractTopLevelIgnoredDirs(content)).toEqual([
      'build',
      'dist',
      'node_modules',
      'out',
    ]);
  });

  it('respects effectiveRootIgnore when base ignores or root rules interact', () => {
    const base = GitIgnoreFile.empty().chain('', 'vendor/\n');
    const rootContent = 'target/\n!target/\ncache/\n';
    const effective = base.chain('', rootContent);
    expect(extractTopLevelIgnoredDirs(rootContent, effective)).toEqual([
      'cache',
    ]);
  });
});
