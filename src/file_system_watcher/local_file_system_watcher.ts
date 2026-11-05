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

/// <reference types="node" />

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as watcher from '@parcel/watcher';
import {
  FileSystemWatcher,
  SnapshotDelta,
  FileChangeType,
  FileChange,
} from './file_system_watcher';
import {GitIgnoreFile, extractTopLevelIgnoredDirs} from './gitignore';
import {
  logAndShowInternalError,
  logAndShowUserError,
  logError,
  logInfo,
} from '../logging/logging';
import {JjError} from '../error/error';

const NOOP_SUBSCRIPTION: watcher.AsyncSubscription = {
  unsubscribe: () => Promise.resolve(),
};

export interface LocalFileSystemWatcherTestInjections {
  overrideSubscribeForTests?: typeof watcher.subscribe;
  envForTests?: Readonly<Record<string, string | undefined>>;
  homeDirForTests?: string;
}

/**
 * A local file system watcher that watches for file system updates using @parcel/watcher.
 * @parcel/watcher is used instead of vscode.workspace.createFileSystemWatcher since
 * the former supports file exclusions. This is critical for us to ignore file updates
 * from .gitignore files. According to https://github.com/microsoft/vscode/issues/169724,
 * there is no plan to support file exclusions for the builtin file watcher.
 */
export class LocalFileSystemWatcher
  implements FileSystemWatcher, vscode.Disposable
{
  /**
   * The current snapshot number. To satisfy the FileSystemWatcher interface,
   * we create a monotonically increasing counter.
   */
  private snapshotNumber = 0;

  /** Callbacks provided by all subscribers. */
  private readonly callbacks = new Set<
    (snapshotDelta: SnapshotDelta | undefined) => void
  >();

  /** Active or pending `@parcel/watcher` subscription promise. */
  private parcelSubscription: Promise<watcher.AsyncSubscription>;

  /** Watch subscription function (`watcher.subscribe` in production). */
  private readonly subscribeFn: typeof watcher.subscribe;

  /** Evaluates and caches workspace `.gitignore` and VCS exclude rules. */
  private readonly ignoreManager: WorkspaceIgnoreManager;

  /** Relative directory paths passed to the active `@parcel/watcher` `opts.ignore`. */
  private currentNativeIgnores: readonly string[] = [];

  /**
   * Monotonically increasing counter incremented on each `startSubscription`
   * call to ignore callbacks or completions from superseded subscriptions.
   */
  private subscriptionGeneration = 0;

  /** Whether `dispose()` has been called on this watcher. */
  private disposed = false;

  get _testOnlyParcelSubscription(): Promise<watcher.AsyncSubscription> {
    return this.parcelSubscription;
  }

  /**
   * Path to the directory that is being watched. Must be an absolute path
   * and without a trailing slash (except for root).
   */
  private readonly dirPath: string;

  /**
   * Path to the `.jj/working_copy/checkout` file. Must be an absolute path
   * and without a trailing slash.
   */
  private readonly checkoutPath: string;

  constructor(
    targetPath: string,
    testInjections?: LocalFileSystemWatcherTestInjections,
  ) {
    if (!path.isAbsolute(targetPath)) {
      throw logAndShowInternalError(
        `LocalFileSystemWatcher received non-absolute path: ${targetPath}`,
      );
    }

    // Since parcel watcher does not follow symlinks, we'll need to get the
    // actual path. Also, realPath strips trailing slashes except for root dirs.
    try {
      this.dirPath = fs.realpathSync.native(targetPath);
    } catch (err: unknown) {
      throw logAndShowUserError(
        JjError.from(err).addPrefix(
          `LocalFileSystemWatcher failed to resolve path: ${targetPath}`,
        ),
      );
    }

    this.checkoutPath = path.join(
      this.dirPath,
      '.jj',
      'working_copy',
      'checkout',
    );
    this.subscribeFn =
      testInjections?.overrideSubscribeForTests ?? watcher.subscribe;

    const env = testInjections?.envForTests ?? process.env;
    const homeDir = testInjections?.homeDirForTests ?? safeHomeDir();
    this.ignoreManager = new WorkspaceIgnoreManager(this.dirPath, env, homeDir);

    const initialNativeIgnores = this.ignoreManager.getNativeIgnorePaths();
    this.parcelSubscription = this.startSubscription(initialNativeIgnores);
  }

  subscribe(
    cb: (snapshotDelta: SnapshotDelta | undefined) => void,
  ): vscode.Disposable {
    if (!this.disposed) {
      this.callbacks.add(cb);
    }
    return {
      dispose: () => {
        this.callbacks.delete(cb);
      },
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.callbacks.clear();
    try {
      const subscription = this.parcelSubscription;
      // Clear the parcelSubscription, to avoid repeated dispose()
      // calls from calling unsubscribe repeatedly
      this.parcelSubscription = Promise.resolve(NOOP_SUBSCRIPTION);
      await (await subscription).unsubscribe();
    } catch (err: unknown) {
      logError(
        JjError.from(err).addPrefix('FileSystemWatcher failed to unsubscribe'),
      );
    }
  }

  private startSubscription(
    nativeIgnores: readonly string[],
    previousSubscription?: Promise<watcher.AsyncSubscription>,
  ): Promise<watcher.AsyncSubscription> {
    const generation = ++this.subscriptionGeneration;
    this.currentNativeIgnores = nativeIgnores;

    const nextSubscription = (async (): Promise<watcher.AsyncSubscription> => {
      if (previousSubscription) {
        try {
          const prev = await previousSubscription;
          await prev.unsubscribe();
        } catch (err: unknown) {
          logError(
            JjError.from(err).addPrefix(
              'FileSystemWatcher failed to unsubscribe',
            ),
          );
        }
      }

      if (this.disposed || generation !== this.subscriptionGeneration) {
        return NOOP_SUBSCRIPTION;
      }

      const sub = await this.subscribeFn(
        this.dirPath,
        (err, events) => {
          if (this.disposed || generation !== this.subscriptionGeneration) {
            return;
          }
          if (err) {
            logError(JjError.from(err).addPrefix('FileSystemWatcher error'));
            this.ignoreManager.reset();
            const nextNativeIgnores = this.ignoreManager.getNativeIgnorePaths();
            if (
              !stringArraysEqual(this.currentNativeIgnores, nextNativeIgnores)
            ) {
              void this.startSubscription(
                nextNativeIgnores,
                this.parcelSubscription,
              );
              return;
            }
            // Notify subscribers that everything changed.
            this.notifySubscribers(undefined);
            return;
          }
          this.publishSnapshot(events);
        },
        {ignore: [...nativeIgnores]},
      );

      if (this.disposed || generation !== this.subscriptionGeneration) {
        try {
          await sub.unsubscribe();
        } catch (err: unknown) {
          logError(
            JjError.from(err).addPrefix(
              'FileSystemWatcher failed to unsubscribe',
            ),
          );
        }
        return NOOP_SUBSCRIPTION;
      }

      this.ignoreManager.reset();
      const latestNativeIgnores = this.ignoreManager.getNativeIgnorePaths();
      if (!stringArraysEqual(nativeIgnores, latestNativeIgnores)) {
        return this.startSubscription(
          latestNativeIgnores,
          Promise.resolve(sub),
        );
      }

      logInfo(`LocalFileSystemWatcher watching: ${this.dirPath}`);
      // Once the watcher is ready, notify that everything changed so
      // the caller does not miss updates in between.
      this.notifySubscribers(undefined);
      return sub;
    })();

    nextSubscription.catch((err: unknown) => {
      if (!this.disposed) {
        logAndShowUserError(
          JjError.from(err).addPrefix('FileSystemWatcher failed to subscribe'),
        );
      }
    });

    this.parcelSubscription = nextSubscription;
    return nextSubscription;
  }

  private publishSnapshot(events: watcher.Event[]) {
    const stateChanged = events.some(
      (event) => event.path === this.checkoutPath,
    );

    let recheckNativeIgnores = false;
    const normalizedEvents: Array<{
      absPath: string;
      posixPath: string;
      type: FileChangeType;
    }> = [];

    // Pass 1: Normalize relative paths to POSIX '/', drop VCS internal paths
    // (.jj / .git), record ancestor directories, and invalidate stale cached
    // ignore rules before filtering any events in this batch.
    for (const event of events) {
      const posixPath = toWorkspaceRelativePosixPath(this.dirPath, event.path);
      if (posixPath === undefined) {
        continue;
      }

      if (hasReservedVcsSegment(posixPath)) {
        // VCS internal directories (.git and .jj/repo) are natively excluded in
        // @parcel/watcher opts.ignore, and .jj/working_copy events (such as
        // working_copy.lock or checkout) must never appear in fileChanges.
        continue;
      }

      const changeType = this.convertChangeType(event.type);
      this.ignoreManager.recordKnownDirAncestors(posixPath);

      if (this.ignoreManager.isWorkspaceExcludesFile(posixPath)) {
        this.ignoreManager.invalidateAll();
        recheckNativeIgnores = true;
      } else if (posixPath === '.gitignore') {
        this.ignoreManager.invalidateSubtree('');
        recheckNativeIgnores = true;
      } else if (posixPath.endsWith('/.gitignore')) {
        const parentDir = posixPath.slice(
          0,
          posixPath.length - '/.gitignore'.length,
        );
        this.ignoreManager.invalidateSubtree(parentDir);
      } else if (changeType === FileChangeType.DELETED) {
        this.ignoreManager.invalidateSubtree(posixPath);
      }

      normalizedEvents.push({
        absPath: event.path,
        posixPath,
        type: changeType,
      });
    }

    // Pass 2: Filter out gitignored paths against updated ignore rules.
    const fileChanges: FileChange[] = [];
    for (const item of normalizedEvents) {
      if (
        !this.ignoreManager.isIgnored(item.posixPath, item.absPath, item.type)
      ) {
        fileChanges.push({
          path: item.posixPath,
          type: item.type,
        });
      }
    }

    // Clean up deleted directories from knownDirs after evaluating the batch.
    for (const item of normalizedEvents) {
      if (item.type === FileChangeType.DELETED) {
        this.ignoreManager.pruneDeletedKnownDir(item.posixPath);
      }
    }

    if (recheckNativeIgnores && !this.disposed) {
      const nextNativeIgnores = this.ignoreManager.getNativeIgnorePaths();
      if (!stringArraysEqual(this.currentNativeIgnores, nextNativeIgnores)) {
        void this.startSubscription(nextNativeIgnores, this.parcelSubscription);
      }
    }

    if (!stateChanged && fileChanges.length === 0) {
      return;
    }

    const snapshotDelta: SnapshotDelta = {
      stateChanged,
      snapshotNumber: ++this.snapshotNumber,
      fileChanges,
    };

    this.notifySubscribers(snapshotDelta);
  }

  private notifySubscribers(snapshotDelta: SnapshotDelta | undefined) {
    if (this.disposed) {
      return;
    }
    for (const cb of this.callbacks) {
      try {
        cb(snapshotDelta);
      } catch (err: unknown) {
        // If one of the callers threw an error, the rest of the callers
        // should still get their callback invoked. So we log the error and
        // then eat it.
        logError(err);
      }
    }
  }

  private convertChangeType(type: watcher.EventType): FileChangeType {
    switch (type) {
      case 'create':
        return FileChangeType.ADDED;
      case 'update':
        return FileChangeType.MODIFIED;
      case 'delete':
        return FileChangeType.DELETED;
    }
  }
}

/**
 * Loads Jujutsu CLI-equivalent `base_ignores` (global Git excludes +
 * `<git_common_dir>/info/exclude`) and lazily caches regular-file `.gitignore`
 * chains per non-ignored workspace directory.
 *
 * Design principle: Only base ignores and the root `.gitignore` are read at
 * startup; nested `.gitignore` files are read on demand only when watcher
 * events occur under their directories (and skipped entirely beneath ignored
 * ancestor directories). Avoiding an eager directory-tree walk allows this to
 * scale to very large or VFS-backed repositories.
 */
class WorkspaceIgnoreManager {
  /**
   * Cached base ignore rules loaded from global Git excludes (`core.excludesFile`
   * or `$XDG_CONFIG_HOME/git/ignore`) and `<git_common_dir>/info/exclude`.
   */
  private baseIgnores: GitIgnoreFile | undefined;

  /**
   * Workspace-relative POSIX path when `core.excludesFile` points to a file
   * inside `workspaceRoot`, used to invalidate `baseIgnores` when that file is
   * modified.
   */
  private workspaceExcludesPosixPath: string | undefined;

  /**
   * Lazily populated cache mapping a workspace-relative POSIX directory path
   * (`''` for the workspace root) to its effective chained `GitIgnoreFile`.
   */
  private readonly dirIgnoreCache = new Map<string, GitIgnoreFile>();

  /**
   * Raw contents of `<workspaceRoot>/.gitignore` from the last root-ignore load,
   * retained to compute top-level native directory excludes.
   */
  private rootGitIgnoreContent = '';

  /**
   * Workspace-relative POSIX paths previously observed to be directories.
   * `.gitignore` differentiates between file ignores and directory ignores
   * using `<path>` vs. `<path>/`, while `@parcel/watcher` `delete` events only
   * provide the path without file/directory metadata; `knownDirs` bridges that
   * gap by tracking the previous entry type.
   */
  private readonly knownDirs = new Set<string>();

  constructor(
    private readonly workspaceRoot: string,
    private readonly env: Readonly<Record<string, string | undefined>>,
    private readonly homeDir: string | undefined,
  ) {}

  getNativeIgnorePaths(): string[] {
    const rootIgnore = this.getRootIgnore();
    const nativeIgnores = new Set<string>(['.git']);

    // Note: If a future OpHeadsWatcher watches `.jj/repo/op_heads/heads` via
    // this watcher, this exclusion may need to be narrowed to specific
    // high-churn subdirectories (such as `.jj/repo/store` and `.jj/repo/op_store`).
    if (isDirectoryNoFollow(path.join(this.workspaceRoot, '.jj', 'repo'))) {
      nativeIgnores.add('.jj/repo');
    }

    for (const dir of extractTopLevelIgnoredDirs(
      this.rootGitIgnoreContent,
      rootIgnore,
    )) {
      if (
        !rootIgnore.matchesFile(dir) &&
        isExistingNonDirectoryNoFollow(path.join(this.workspaceRoot, dir))
      ) {
        continue;
      }
      nativeIgnores.add(dir);
    }

    return Array.from(nativeIgnores).sort();
  }

  isWorkspaceExcludesFile(posixRelPath: string): boolean {
    if (this.baseIgnores === undefined) {
      this.getBaseIgnores();
    }
    return (
      this.workspaceExcludesPosixPath !== undefined &&
      posixRelPath === this.workspaceExcludesPosixPath
    );
  }

  recordKnownDirAncestors(posixRelPath: string): void {
    let slashIdx = posixRelPath.indexOf('/');
    while (slashIdx !== -1) {
      this.knownDirs.add(posixRelPath.slice(0, slashIdx));
      slashIdx = posixRelPath.indexOf('/', slashIdx + 1);
    }
  }

  pruneDeletedKnownDir(posixRelPath: string): void {
    if (!this.knownDirs.delete(posixRelPath)) {
      return;
    }
    const prefix = `${posixRelPath}/`;
    for (const dir of this.knownDirs) {
      if (dir.startsWith(prefix)) {
        this.knownDirs.delete(dir);
      }
    }
  }

  reset(): void {
    this.invalidateAll();
    this.knownDirs.clear();
  }

  invalidateAll(): void {
    this.baseIgnores = undefined;
    this.workspaceExcludesPosixPath = undefined;
    this.dirIgnoreCache.clear();
    this.rootGitIgnoreContent = '';
  }

  invalidateSubtree(posixDir: string): void {
    if (posixDir === '') {
      this.dirIgnoreCache.clear();
      this.rootGitIgnoreContent = '';
      return;
    }
    if (!this.dirIgnoreCache.delete(posixDir)) {
      return;
    }
    const prefix = `${posixDir}/`;
    for (const key of this.dirIgnoreCache.keys()) {
      if (key.startsWith(prefix)) {
        this.dirIgnoreCache.delete(key);
      }
    }
  }

  isIgnored(
    posixRelPath: string,
    absPath: string,
    changeType: FileChangeType,
  ): boolean {
    let currentIgnore = this.getRootIgnore();

    // Walk ancestor directories top-down. Once a directory matches as ignored,
    // all paths beneath it are ignored without loading nested .gitignore files.
    let slashIdx = posixRelPath.indexOf('/');
    while (slashIdx !== -1) {
      const ancestorDir = posixRelPath.slice(0, slashIdx);
      if (currentIgnore.matchesDir(ancestorDir)) {
        return true;
      }
      currentIgnore = this.getSubdirIgnore(ancestorDir, currentIgnore);
      slashIdx = posixRelPath.indexOf('/', slashIdx + 1);
    }

    let isDir: boolean;
    if (changeType === FileChangeType.DELETED) {
      isDir = this.knownDirs.has(posixRelPath);
    } else {
      isDir = isDirectoryNoFollow(absPath);
      if (isDir) {
        this.knownDirs.add(posixRelPath);
      } else {
        this.knownDirs.delete(posixRelPath);
      }
    }

    return isDir
      ? currentIgnore.matchesDir(posixRelPath)
      : currentIgnore.matchesFile(posixRelPath);
  }

  private getRootIgnore(): GitIgnoreFile {
    const cached = this.dirIgnoreCache.get('');
    if (cached !== undefined) {
      return cached;
    }

    const base = this.getBaseIgnores();
    const rootGitIgnorePath = path.join(this.workspaceRoot, '.gitignore');
    const content = readRegularFileNoFollow(rootGitIgnorePath) ?? '';
    this.rootGitIgnoreContent = content;
    const chained = content !== '' ? base.chain('', content) : base;
    this.dirIgnoreCache.set('', chained);
    return chained;
  }

  private getSubdirIgnore(
    posixDir: string,
    parentIgnore: GitIgnoreFile,
  ): GitIgnoreFile {
    const cached = this.dirIgnoreCache.get(posixDir);
    if (cached !== undefined) {
      return cached;
    }

    const diskGitIgnorePath = path.join(
      this.workspaceRoot,
      ...posixDir.split('/'),
      '.gitignore',
    );
    const content = readRegularFileNoFollow(diskGitIgnorePath);
    const chained =
      content !== undefined && content !== ''
        ? parentIgnore.chain(posixDir, content)
        : parentIgnore;
    this.dirIgnoreCache.set(posixDir, chained);
    return chained;
  }

  private getBaseIgnores(): GitIgnoreFile {
    if (this.baseIgnores !== undefined) {
      return this.baseIgnores;
    }

    const gitCommonDir = this.resolveWorkspaceGitCommonDir();
    const globalExcludesPath = this.resolveGlobalExcludesPath(gitCommonDir);
    this.workspaceExcludesPosixPath =
      globalExcludesPath !== undefined
        ? toWorkspaceRelativePosixPath(this.workspaceRoot, globalExcludesPath)
        : undefined;

    let ignores = GitIgnoreFile.empty();
    if (globalExcludesPath !== undefined) {
      const globalContent = readFollowedFile(globalExcludesPath);
      if (globalContent !== undefined) {
        ignores = ignores.chain('', globalContent);
      }
    }

    if (gitCommonDir !== undefined) {
      const repoExcludePath = path.join(gitCommonDir, 'info', 'exclude');
      const repoExcludeContent = readFollowedFile(repoExcludePath);
      if (repoExcludeContent !== undefined) {
        ignores = ignores.chain('', repoExcludeContent);
      }
    }

    this.baseIgnores = ignores;
    return ignores;
  }

  private resolveWorkspaceGitCommonDir(): string | undefined {
    const jjDir = path.join(this.workspaceRoot, '.jj');
    const jjRepoEntry = path.join(jjDir, 'repo');

    let repoDir: string | undefined;
    if (isDirectoryNoFollow(jjRepoEntry)) {
      repoDir = jjRepoEntry;
    } else {
      const pointerContent = readFollowedFile(jjRepoEntry);
      if (pointerContent !== undefined) {
        const relRepoPath = pointerContent.replace(/\r?\n$/, '');
        if (relRepoPath !== '') {
          repoDir = path.resolve(jjDir, relRepoPath);
        }
      }
    }

    if (repoDir !== undefined) {
      const storeDir = path.join(repoDir, 'store');
      const gitTargetContent = readFollowedFile(
        path.join(storeDir, 'git_target'),
      );
      if (gitTargetContent !== undefined) {
        const relGitTarget = gitTargetContent.replace(/\r?\n$/, '');
        if (relGitTarget !== '') {
          const resolvedGitTarget = resolveGitCommonDirFromEntry(
            path.resolve(storeDir, relGitTarget),
          );
          if (resolvedGitTarget !== undefined) {
            return resolvedGitTarget;
          }
        }
      }
    }

    return resolveGitCommonDirFromEntry(path.join(this.workspaceRoot, '.git'));
  }

  private resolveGlobalExcludesPath(
    gitCommonDir: string | undefined,
  ): string | undefined {
    const rawXdg = this.env['XDG_CONFIG_HOME'];
    const xdgConfigHome =
      rawXdg !== undefined && rawXdg !== ''
        ? rawXdg
        : this.homeDir !== undefined
          ? path.join(this.homeDir, '.config')
          : undefined;

    const configCandidates: string[] = [];
    if (gitCommonDir !== undefined) {
      configCandidates.push(path.join(gitCommonDir, 'config'));
    }
    if (this.homeDir !== undefined) {
      configCandidates.push(path.join(this.homeDir, '.gitconfig'));
    }
    if (xdgConfigHome !== undefined) {
      configCandidates.push(path.join(xdgConfigHome, 'git', 'config'));
    }

    for (const configPath of configCandidates) {
      const content = readFollowedFile(configPath);
      if (content === undefined) {
        continue;
      }
      const configured = extractCoreExcludesFileFromGitConfig(content);
      if (configured !== undefined) {
        if (configured === '') {
          return undefined;
        }
        const expanded = expandHomePath(configured, this.homeDir);
        return path.resolve(this.workspaceRoot, expanded);
      }
    }

    if (xdgConfigHome !== undefined) {
      return path.join(xdgConfigHome, 'git', 'ignore');
    }
    return undefined;
  }
}

function resolveGitCommonDirFromEntry(
  candidatePath: string,
): string | undefined {
  let gitDir: string | undefined;
  if (isFollowedDirectory(candidatePath)) {
    gitDir = candidatePath;
  } else {
    const fileContent = readFollowedFile(candidatePath);
    if (fileContent !== undefined) {
      const firstLine = fileContent.split(/\r?\n/, 1)[0];
      if (firstLine.startsWith('gitdir:')) {
        const rawTarget = firstLine.slice('gitdir:'.length).trim();
        if (rawTarget !== '') {
          const resolved = path.resolve(path.dirname(candidatePath), rawTarget);
          if (isFollowedDirectory(resolved)) {
            gitDir = resolved;
          }
        }
      }
    }
  }

  if (gitDir === undefined) {
    return undefined;
  }

  const commonDirContent = readFollowedFile(path.join(gitDir, 'commondir'));
  if (commonDirContent !== undefined) {
    const relCommon = commonDirContent.replace(/\r?\n$/, '').trim();
    if (relCommon !== '') {
      const resolvedCommon = path.resolve(gitDir, relCommon);
      if (isFollowedDirectory(resolvedCommon)) {
        return resolvedCommon;
      }
    }
  }

  return gitDir;
}

/**
 * Extracts the last `core.excludesFile` string setting from a Git INI config
 * file, or `undefined` if `core.excludesFile` is not set in this file.
 */
function extractCoreExcludesFileFromGitConfig(
  rawContent: string,
): string | undefined {
  const content = rawContent.startsWith('\uFEFF')
    ? rawContent.slice(1)
    : rawContent;
  const logicalLines = joinGitConfigContinuedLines(content);

  let inCoreSection = false;
  let foundValue: string | undefined;

  for (const rawLine of logicalLines) {
    let line = rawLine.trimStart();
    if (line === '' || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }

    if (line.startsWith('[')) {
      const closeIdx = findSectionHeaderClose(line);
      if (closeIdx === -1) {
        continue;
      }
      const headerBody = line.slice(1, closeIdx).trim();
      // Subsection headers like `[core "sub"]` do not match plain `[core]`.
      inCoreSection =
        !/[\s"]/.test(headerBody) && headerBody.toLowerCase() === 'core';
      line = line.slice(closeIdx + 1).trimStart();
      if (line === '' || line.startsWith('#') || line.startsWith(';')) {
        continue;
      }
    }

    if (!inCoreSection) {
      continue;
    }

    const eqIdx = findUncommentedEquals(line);
    if (eqIdx === -1) {
      continue;
    }

    const key = line.slice(0, eqIdx).trim().toLowerCase();
    if (key !== 'excludesfile') {
      continue;
    }

    foundValue = parseGitConfigStringValue(line.slice(eqIdx + 1));
  }

  return foundValue;
}

function joinGitConfigContinuedLines(content: string): string[] {
  const physicalLines = content.split(/\r?\n/);
  const result: string[] = [];
  let pending = '';

  for (const line of physicalLines) {
    const full = pending + line;
    if (hasUncommentedTrailingBackslash(full)) {
      pending = full.slice(0, -1);
    } else {
      result.push(full);
      pending = '';
    }
  }
  if (pending !== '') {
    result.push(pending);
  }
  return result;
}

function hasUncommentedTrailingBackslash(line: string): boolean {
  let inQuotes = false;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (ch === '#' || ch === ';')) {
      return false;
    }
  }
  return escaped;
}

function findSectionHeaderClose(line: string): number {
  let inQuotes = false;
  let escaped = false;
  for (let i = 1; i < line.length; i++) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inQuotes && ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ']') {
      return i;
    }
  }
  return -1;
}

function findUncommentedEquals(line: string): number {
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '#' || ch === ';') {
      return -1;
    }
    if (ch === '=') {
      return i;
    }
  }
  return -1;
}

function parseGitConfigStringValue(rawAfterEquals: string): string {
  const trimmedStart = rawAfterEquals.replace(/^[ \t]+/, '');
  let inQuotes = false;
  let out = '';
  let lastSignificantLength = 0;

  for (let i = 0; i < trimmedStart.length; i++) {
    const ch = trimmedStart[i];
    if (ch === '\\') {
      i++;
      if (i >= trimmedStart.length) {
        break;
      }
      const next = trimmedStart[i];
      switch (next) {
        case 'n':
          out += '\n';
          break;
        case 't':
          out += '\t';
          break;
        case 'b':
          out += '\b';
          break;
        default:
          out += next;
          break;
      }
      lastSignificantLength = out.length;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      lastSignificantLength = out.length;
      continue;
    }

    if (!inQuotes && (ch === '#' || ch === ';')) {
      break;
    }

    out += ch;
    if (inQuotes || (ch !== ' ' && ch !== '\t')) {
      lastSignificantLength = out.length;
    }
  }

  return out.slice(0, lastSignificantLength);
}

function expandHomePath(
  configuredPath: string,
  homeDir: string | undefined,
): string {
  if (homeDir === undefined || homeDir === '') {
    return configuredPath;
  }
  if (configuredPath === '~') {
    return homeDir;
  }
  if (configuredPath.startsWith('~/') || configuredPath.startsWith('~\\')) {
    return path.join(homeDir, configuredPath.slice(2));
  }
  return configuredPath;
}

function safeHomeDir(): string | undefined {
  try {
    const home = os.homedir();
    return home !== '' ? home : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Working-copy `.gitignore` files must be regular files (not symlinks,
 * directories, or FIFOs), matching Jujutsu's `symlink_metadata().is_file()`.
 */
function readRegularFileNoFollow(filePath: string): string | undefined {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile()) {
      return undefined;
    }
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Reads a file following symlinks (used for user/repo Git configs, global
 * excludes, and `.jj/repo` / `git_target` pointer files).
 */
function readFollowedFile(filePath: string): string | undefined {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return undefined;
    }
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

function isDirectoryNoFollow(targetPath: string): boolean {
  try {
    return fs.lstatSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function isExistingNonDirectoryNoFollow(targetPath: string): boolean {
  try {
    return !fs.lstatSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function isFollowedDirectory(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function toWorkspaceRelativePosixPath(
  workspaceRoot: string,
  targetPath: string,
): string | undefined {
  const rawRel = path.relative(workspaceRoot, targetPath);
  if (
    rawRel === '' ||
    rawRel === '.' ||
    rawRel === '..' ||
    rawRel.startsWith(`..${path.sep}`) ||
    path.isAbsolute(rawRel)
  ) {
    return undefined;
  }
  return path.sep === '/' ? rawRel : rawRel.split(path.sep).join('/');
}

function hasReservedVcsSegment(posixRelPath: string): boolean {
  let start = 0;
  while (start <= posixRelPath.length) {
    const slashIdx = posixRelPath.indexOf('/', start);
    const segment =
      slashIdx === -1
        ? posixRelPath.slice(start)
        : posixRelPath.slice(start, slashIdx);
    if (segment === '.jj' || segment === '.git') {
      return true;
    }
    if (slashIdx === -1) {
      break;
    }
    start = slashIdx + 1;
  }
  return false;
}

function stringArraysEqual(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
