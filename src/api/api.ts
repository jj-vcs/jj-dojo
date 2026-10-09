/**
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

/** A single commit in the commit history. */
export interface Commit {
  readonly id: CommitId;
  readonly changeId: ChangeId;

  readonly parents: readonly CommitId[];
  readonly children: readonly CommitId[];

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

  /** A human friendly identifier for the commit. */
  readonly displayId: string;

  /**
   * The first n characters of displayId that should be highlighted in the UI.
   * This is the minimum length of the displayId that uniquely identifies a
   * commit.
   */
  readonly highlightedDisplayIdLen: number;

  /**
   * The change offset of this commit. Set iff `hasDiverged` is true.
   * https://docs.jj-vcs.dev/latest/glossary/#change-offset
   */
  readonly changeOffset: number | undefined;
}

/** The Repo state. */
export interface RepoState {
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
