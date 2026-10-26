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

import {HashMapKey} from '../utils/hashmap';
import {HashSet, ReadonlyHashSet} from '../utils/hashset';
import {Merge} from '../utils/merge';

/** A unique ID for a commit. */
export class CommitId implements HashMapKey {
  constructor(readonly hex: string) {}
  toString() {
    return this.hex;
  }
}

/** The change ID of a commit. */
export class ChangeId implements HashMapKey {
  constructor(readonly hex: string) {}
  toString() {
    return this.hex;
  }
}

/** A unique ID for an operation. */
export class OperationId implements HashMapKey {
  constructor(readonly hex: string) {}
  toString() {
    return this.hex;
  }
}

/** A unique ID for a file. */
export class FileId implements HashMapKey {
  constructor(readonly hex: string) {}
  toString() {
    return this.hex;
  }
}

/** A single commit in the commit history. */
export interface Commit {
  readonly id: CommitId;
  readonly changeId: ChangeId;

  readonly parentIds: readonly CommitId[];
  readonly childIds: readonly CommitId[];

  /** True iff the commit is the working copy commit. */
  readonly active: boolean;

  /** True iff the commit is (any of) the parents of the current working copy commit. */
  readonly isWorkingCopyParentCommit: boolean;

  /** The full unmodified description of the commit. */
  readonly description: string;

  /**
   * The title of the commit description. Usually this is the first line of the description.
   * The implementation may strip common metadata phrases from the description, so it can
   * be different from the first line of the description.
   */
  readonly descriptionTitle: string;

  /**
   * The files that are modified in this commit.
   */
  readonly files: CommitFile[];

  /**
   * The commit's last updated timestamp (milliseconds since epoch).
   * This is set from the committer timestamp and specifies the time when the
   * commit was last modified, including file changes, description updates,
   * syncs or rebases.
   */
  readonly updateTime: number;

  /**
   * The commit's created timestamp (milliseconds since epoch).
   * This is set from the author timestamp and specifies the time when the
   * commit first became non-empty.
   */
  readonly createdTime: number;

  readonly hasConflict: boolean;

  /** True iff there are other commits in the repo with the same change id. */
  readonly hasDiverged: boolean;

  /**
   * True iff the commit is immutable (e.g. the root commit or an ancestor of
   * `immutable_heads()`).
   * https://docs.jj-vcs.dev/latest/config/#set-of-immutable-commits
   */
  readonly isImmutable: boolean;

  /** A human friendly identifier for the commit. */
  readonly displayId: string;

  /**
   * The first n characters of displayId that should be highlighted in the UI.
   * This is the minimum length of the displayId that uniquely identifies a
   * commit.
   */
  readonly highlightedDisplayIdLen: number;

  /**
   * The list of local and remote bookmarks pointing to this commit.
   * A tracked remote bookmark is included only if its target differs from the
   * local bookmark's target (matching `jj`'s `commit.bookmarks()` behavior).
   */
  readonly bookmarks: readonly Bookmark[];

  /**
   * The change offset of this commit. Set iff `hasDiverged` is true.
   * https://docs.jj-vcs.dev/latest/glossary/#change-offset
   */
  readonly changeOffset: number | undefined;

  /**
   * The ancestors of this commit up to and including public commit bases
   * including itself
   */
  readonly ancestors: ReadonlyHashSet<CommitId>;

  /** The descendants of this commit including itself. */
  readonly descendants: ReadonlyHashSet<CommitId>;

  /** The list of workspaces that have this commit as their working copy. */
  readonly workingCopies: readonly WorkingCopy[];
}

/** A mutable version of {@link Commit}. */
export type MutableCommit = {
  -readonly [K in keyof Commit]: Commit[K] extends ReadonlyHashSet<infer T>
    ? HashSet<T>
    : Commit[K];
};

/** The Repo state. */
export interface RepoState {
  /**
   * The operation the RepoState is based on. This can be an unpublished
   * (i.e. --no-integrate-operation) or published operation.
   */
  readonly opHead: OperationId;

  readonly commits: readonly Commit[];
}

/** The state of the repo and the working copy. */
export interface RepoAndWorkingCopyState {
  readonly repoState: RepoState;
  /**
   * The most recent snapshot version of the workspace. If zero, the
   * workspace has not been initialized yet.
   */
  readonly snapshotNumber: number;
}

/** A single bookmark in the repository */
export interface Bookmark {
  /** The name of the bookmark. Does not include '@remote' for remote bookmarks. */
  readonly name: string;
  /** The remote name if this is a remote bookmark. */
  readonly remote?: string;
  /**
   * True for non-conflicted local bookmarks out of sync with a tracked remote,
   * matching jj's * symbol.
   */
  readonly needsUpload: boolean;
  readonly isConflicted: boolean;
}

export interface WorkingCopy {
  /**
   * The name of the workspace.
   * Equivalent to `.name()` in https://docs.jj-vcs.dev/latest/templates/#workspaceref-type
   */
  readonly jjWorkspaceId: string;

  /**
   * The absolute path to the workspace root.
   *
   * For JJ CLI implementation, it is usually set except for
   * the conditions mentioned in https://docs.jj-vcs.dev/latest/templates/#workspaceref-type
   */
  readonly workspaceRoot?: string;

  /**
   * The name to use when displaying to users.
   */
  readonly displayName: string;
}

/** A single file in a commit. */
export interface CommitFile {
  readonly path: string;
  readonly modificationType: ModificationType;
  // The metadata of a file. undefined iff modificationType is REMOVED.
  readonly mergedFileMetadata: Merge<FileMetadata | undefined>;
}

/** The type of modification of a file. */
export enum ModificationType {
  UNKNOWN = 'UNKNOWN',
  ADDED = 'ADDED',
  MODIFIED = 'MODIFIED',
  REMOVED = 'REMOVED',
  // TODO: rename this to conflicted
  MERGED = 'MERGED',
}

/** The type of a file. */
export enum FileType {
  FILE = 'FILE',
  SYMLINK = 'SYMLINK',
}

/** Metadata about a file. */
export interface FileMetadata {
  readonly fileType: FileType;
  // The psha2Sum of the file. It can be undefined for newly updated
  // files that have not been snapshotted yet.
  readonly psha2Sum?: string;
}
