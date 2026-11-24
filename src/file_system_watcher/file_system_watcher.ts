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

import * as vscode from 'vscode';

/**
 * Abstraction for a file system watcher compatible with both local and
 * virtual file systems.
 */
export interface FileSystemWatcher {
  /**
   * subscribe to the watcher.
   *
   * @param cb The callback to be invoked when there are new changes to the
   * file system. If `snapshotDelta` is not set, it means any files could have
   * changed. This can happen in network file systems when there are network
   * interruptions and intermediate updates are potentially lost, or in local
   * file systems when the OS event queue overflows (e.g. IN_Q_OVERFLOW on Linux
   * or buffer overflow on Windows/macOS).
   */
  subscribe(
    cb: (snapshotDelta: SnapshotDelta | undefined) => void,
  ): vscode.Disposable;

  /**
   * Returns the current monotonically increasing snapshot number.
   *
   * Implementations increment this counter before emitting either a
   * {@link SnapshotDelta} or an `undefined` full-rescan notification so
   * consumers can request authoritative state at a strictly newer version.
   */
  getCurrentSnapshotNumber(): number;

  /**
   * Allocates and returns the next snapshot number when the watcher maintains a
   * local counter, allowing forced out-of-band refreshes (such as external
   * operation-head updates) to advance past buffered optimistic deltas.
   *
   * Watchers backed by an external virtual-filesystem clock omit this method.
   */
  advanceSnapshotNumber?(): number;
}

export enum FileChangeType {
  ADDED,
  MODIFIED,
  DELETED,
}

export interface SnapshotDelta {
  /**
   * If true, a version-control or workspace state transition occurred that
   * invalidates file-only incremental estimation.
   *
   * In local `jj` repositories, non-atomic checkouts hold
   * `.jj/working_copy/working_copy.lock` while updating working-copy files
   * before writing `.jj/working_copy/checkout` last.
   */
  readonly stateChanged: boolean;
  /** The current snapshot number. It must be monotonically increasing. */
  readonly snapshotNumber: number;
  readonly fileChanges: readonly FileChange[];
}

export interface FileChange {
  /** Path to the file, relative to the workspace root. */
  readonly path: string;
  readonly type: FileChangeType;
}
