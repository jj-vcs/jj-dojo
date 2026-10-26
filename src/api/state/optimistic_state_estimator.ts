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

import {
  Commit,
  CommitFile,
  FileType,
  ModificationType,
  RepoAndWorkingCopyState,
} from '../api';
import {
  FileChangeType,
  SnapshotDelta,
} from '../../file_system_watcher/file_system_watcher';
import {logAndShowInternalError} from '../../logging/logging';
import {checkExhaustive} from '../../utils/check';
import {Merge} from '../../utils/merge';
import {FileIgnoreMatcher} from './file_ignore_matcher';

interface PendingSnapshot {
  snapshotNumber: number;
  files: CommitFile[];
}

/**
 * A class that takes pending snapshots and makes educated guesses about the
 * repo state. These guesses might not be complete, e.g. if a file was never
 * modified in the working copy commit, the guess will not know whether it's
 * ADDED or MODIFIED. In these cases, it simply leaves the modification type as
 * UNKNOWN.
 *
 * When a new CitC snapshot is received, the jj extension will send a
 * GetWorkspaceState RPC to do a trial snapshot of the repo state. This request
 * can be expensive and slow. If the CitC snapshot was a result of a vcs
 * operation, it makes sense to wait for the GetWorkspaceState RPC to
 * finish. However, in most cases it's just a simple file change, then it makes
 * sense to give an update immediately. This class does that.
 */
export class OptimisticStateEstimator {
  // A list of pending snapshots, ordered by increasing snapshot version.
  private readonly pendingSnapshots: PendingSnapshot[] = [];

  constructor(private readonly fileIgnoreMatcher: FileIgnoreMatcher) {}

  clear(): void {
    this.pendingSnapshots.length = 0;
  }

  /**
   * Adds a new snapshot to the list of pending snapshots.
   *
   * Only CitC snapshots with simple file changes are going to be added. For
   * example, if the snapshot:
   *  - changes the citc baseline
   *  - changes the jj repo state
   *  - has citc resource removals
   * they are not added and ignored.
   *
   * In `getEstimatedState`, missing snapshots will cause the optimistic state
   * to stop there and not make further predictions. e.g. If `pendingSnapshots`
   * has information for snapshots [11, 12, 14], and the last known state is
   * snapshot 10, the optimistic state will stop at snapshot 12 and not make
   * further predictions.
   *
   * @return true if the snapshot was added successfully, otherwise it was ignored.
   */
  add(newSnapshot: SnapshotDelta): boolean {
    // Verify that the new snapshot is always larger than the previous one.
    const lastSnapshot =
      this.pendingSnapshots[this.pendingSnapshots.length - 1];
    if (
      lastSnapshot &&
      lastSnapshot.snapshotNumber >= newSnapshot.snapshotNumber
    ) {
      throw logAndShowInternalError(
        `Pending snapshots are not in strictly increasing order: ${lastSnapshot.snapshotNumber} >= ${newSnapshot.snapshotNumber}`,
      );
    }
    if (newSnapshot.stateChanged) {
      // The state changed, so we cannot make any optimistic updates.
      return false;
    }
    this.pendingSnapshots.push({
      snapshotNumber: newSnapshot.snapshotNumber,
      files: toCommitFiles(this.fileIgnoreMatcher, newSnapshot),
    });
    return true;
  }

  /**
   * Returns the estimated state of the repo.
   *
   * This function will also evict snapshots including and before the last known
   * state.
   */
  getEstimatedState(
    lastKnownState: RepoAndWorkingCopyState,
  ): RepoAndWorkingCopyState {
    const oldWcCommit = lastKnownState.repoState.commits.find(
      (commit) => commit.active,
    );
    if (oldWcCommit === undefined) {
      // Workspace is not initialized yet.
      return lastKnownState;
    }
    this.evictBefore(lastKnownState.snapshotNumber);
    if (this.pendingSnapshots.length === 0) {
      // Shortcut to avoid making copies of the state.
      return lastKnownState;
    }
    const files = new Map<string, CommitFile>();
    for (const file of oldWcCommit.files) {
      files.set(file.path, file);
    }
    let currentSnapshotNumber = lastKnownState.snapshotNumber;

    for (const snapshot of this.pendingSnapshots) {
      // Only apply optimistic updates for consecutive snapshots. If there
      // are missing snapshots, stop there and don't make further predictions.
      if (currentSnapshotNumber + 1 !== snapshot.snapshotNumber) {
        break;
      }
      currentSnapshotNumber += 1;
      for (const file of snapshot.files) {
        const oldFile = files.get(file.path);
        const newFile = estimateNewState(oldFile, file);
        if (newFile) {
          files.set(file.path, newFile);
        }
      }
    }
    if (currentSnapshotNumber === lastKnownState.snapshotNumber) {
      // There are no estimated changes on top of the last known state.
      return lastKnownState;
    }

    const estimatedWcCommit: Commit = {
      ...oldWcCommit,
      files: Array.from(files.values()),
    };

    const commits: Commit[] = [];
    for (const commit of lastKnownState.repoState.commits) {
      if (commit.active) {
        commits.push(estimatedWcCommit);
      } else {
        commits.push(commit);
      }
    }

    return {
      snapshotNumber: currentSnapshotNumber,
      repoState: {
        ...lastKnownState.repoState,
        commits,
      },
    };
  }

  /**
   * Evicts all snapshots before and including the given snapshot version.
   */
  private evictBefore(snapshotNumber: number) {
    while (
      this.pendingSnapshots[0] !== undefined &&
      this.pendingSnapshots[0].snapshotNumber <= snapshotNumber
    ) {
      // Shift is O(n), but we don't expect the array to be large.
      this.pendingSnapshots.shift();
    }
  }
}

function toCommitFiles(
  fileIgnoreMatcher: FileIgnoreMatcher,
  snapshot: SnapshotDelta,
): CommitFile[] {
  const files: CommitFile[] = [];
  for (const file of snapshot.fileChanges) {
    const workspacePath = file.path;
    if (fileIgnoreMatcher.isIgnored(workspacePath)) {
      continue;
    }
    switch (file.type) {
      case FileChangeType.ADDED:
      case FileChangeType.MODIFIED: {
        files.push({
          path: workspacePath,
          // The type here isn't useful. A file being marked as MODIFIED can
          // still be and ADDED file if the file only exists in the working
          // copy. So just mark it as UNKNOWN.
          // estimateNewState will update it to inherit from the previous state
          // for the file. If there is no previous state, it will stay as UNKNOWN,
          // and the UI simply don't show a 'M' or 'A' marker until the actual
          // jj snapshot is received.
          modificationType: ModificationType.UNKNOWN,
          mergedFileMetadata: Merge.fromResolved({
            // Hardcoded as FILE. It's not correct, but I also don't think
            // this information is being used anywhere.
            fileType: FileType.FILE,
            psha2Sum: undefined,
          }),
        });
        break;
      }
      case FileChangeType.DELETED: {
        files.push({
          path: workspacePath,
          modificationType: ModificationType.REMOVED,
          mergedFileMetadata: Merge.fromResolved(undefined),
        });
        break;
      }
      default:
        checkExhaustive(file.type);
    }
  }
  return files;
}

/**
 * Returns the estimated new state of the file. If the file should be skipped,
 * returns undefined.
 *
 * @param oldFile The old state of the file from jj repoState.
 * @param newFile The new state of the file from citc.
 */
function estimateNewState(
  oldFile: CommitFile | undefined,
  newFile: CommitFile,
): CommitFile | undefined {
  if (oldFile === undefined) {
    return newFile;
  }
  if (oldFile.modificationType === ModificationType.MERGED) {
    // Don't allow optimistic updates for conflicted files.
    // Changes to conflicted files requires a jj snapshot to calculate
    // the correct state.
    return undefined;
  }
  let modificationType: ModificationType;
  if (newFile.modificationType === ModificationType.REMOVED) {
    modificationType = ModificationType.REMOVED;
  } else if (oldFile.modificationType === ModificationType.REMOVED) {
    modificationType = newFile.modificationType;
  } else {
    // Keep the original modification type.
    modificationType = oldFile.modificationType;
  }
  return {
    ...newFile,
    modificationType,
  };
}
