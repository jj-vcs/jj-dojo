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

import {CommitFile, FileType, ModificationType} from '../api/api';
import {
  FileChange,
  FileChangeType,
  SnapshotDelta,
} from '../file_system_watcher/file_system_watcher';
import {logAndShowInternalError} from '../logging/logging';
import {checkExhaustive} from '../utils/check';
import {Merge} from '../utils/merge';

/** Estimated working-copy file state at a specific snapshot number. */
export interface EstimatedWorkingCopy {
  readonly snapshotNumber: number;
  readonly files: CommitFile[];
}

/**
 * Buffers file-system `SnapshotDelta` batches and computes an optimistic
 * estimate of the working-copy file list before a full backend state refresh
 * completes. Newly observed files use `ModificationType.UNKNOWN` until the
 * backend refresh resolves whether they were added or modified.
 */
export class OptimisticStateEstimator {
  private readonly pendingDeltas: SnapshotDelta[] = [];

  constructor(private readonly isIgnored?: (path: string) => boolean) {}

  /**
   * Discards buffered deltas. Must be paired with resetting the caller's last
   * known state to an uninitialized state (no active working-copy commit /
   * snapshotNumber 0) before new deltas arrive.
   */
  clear(): void {
    this.pendingDeltas.length = 0;
  }

  /**
   * Buffers `delta` when `delta.stateChanged` is false and returns true;
   * returns false without buffering when `delta.stateChanged` is true.
   * Throws via `logAndShowInternalError` if `delta.snapshotNumber` is not
   * strictly greater than the last currently buffered delta's `snapshotNumber`.
   */
  add(delta: SnapshotDelta): boolean {
    const lastDelta = this.pendingDeltas[this.pendingDeltas.length - 1];
    if (lastDelta && lastDelta.snapshotNumber >= delta.snapshotNumber) {
      throw logAndShowInternalError(
        `Snapshot deltas are not in strictly increasing order: ${lastDelta.snapshotNumber} >= ${delta.snapshotNumber}`,
      );
    }
    if (delta.stateChanged) {
      return false;
    }
    this.pendingDeltas.push(delta);
    return true;
  }

  /**
   * Evicts buffered deltas with `snapshotNumber <= lastKnownSnapshotNumber`,
   * then applies consecutive buffered deltas (`lastKnownSnapshotNumber + 1`,
   * ...) onto `lastKnownWcFiles`. Returns undefined if no consecutive delta
   * applies.
   */
  getEstimatedWorkingCopy(
    lastKnownSnapshotNumber: number,
    lastKnownWcFiles: readonly CommitFile[],
  ): EstimatedWorkingCopy | undefined {
    this.evictBefore(lastKnownSnapshotNumber);
    if (this.pendingDeltas.length === 0) {
      return undefined;
    }

    const files = new Map<string, CommitFile>();
    for (const file of lastKnownWcFiles) {
      files.set(file.path, file);
    }
    let currentSnapshotNumber = lastKnownSnapshotNumber;

    for (const delta of this.pendingDeltas) {
      if (currentSnapshotNumber + 1 !== delta.snapshotNumber) {
        break;
      }
      currentSnapshotNumber += 1;
      for (const change of delta.fileChanges) {
        if (!files.has(change.path) && this.isIgnored?.(change.path)) {
          continue;
        }
        const newFile = estimateNewState(
          files.get(change.path),
          toCommitFile(change),
        );
        if (newFile) {
          files.set(change.path, newFile);
        }
      }
    }

    if (currentSnapshotNumber === lastKnownSnapshotNumber) {
      return undefined;
    }
    return {
      snapshotNumber: currentSnapshotNumber,
      files: Array.from(files.values()),
    };
  }

  private evictBefore(snapshotNumber: number): void {
    while (
      this.pendingDeltas[0] !== undefined &&
      this.pendingDeltas[0].snapshotNumber <= snapshotNumber
    ) {
      this.pendingDeltas.shift();
    }
  }
}

function toCommitFile(change: FileChange): CommitFile {
  switch (change.type) {
    case FileChangeType.ADDED:
    case FileChangeType.MODIFIED:
      return {
        path: change.path,
        modificationType: ModificationType.UNKNOWN,
        mergedFileMetadata: Merge.fromResolved({fileType: FileType.FILE}),
      };
    case FileChangeType.DELETED:
      return {
        path: change.path,
        modificationType: ModificationType.REMOVED,
        mergedFileMetadata: Merge.fromResolved(undefined),
      };
    default:
      checkExhaustive(change.type);
  }
}

function estimateNewState(
  oldFile: CommitFile | undefined,
  newFile: CommitFile,
): CommitFile | undefined {
  if (oldFile?.modificationType === ModificationType.MERGED) {
    return undefined;
  }
  if (
    oldFile === undefined ||
    newFile.modificationType === ModificationType.REMOVED ||
    oldFile.modificationType === ModificationType.REMOVED
  ) {
    return newFile;
  }
  return {...newFile, modificationType: oldFile.modificationType};
}
