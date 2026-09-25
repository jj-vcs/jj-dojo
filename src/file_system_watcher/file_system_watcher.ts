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

import * as vscode from 'vscode';

/**
 * Abstraction for a file system watcher. We'd like the JJ Dojo extension
 * to be compatible with vfs (virtual file systems). Internally, this
 * would correspond to the citc pubsub.
 */
export interface FileSystemWatcher {
  /**
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
}

export enum FileChangeType {
  ADDED,
  MODIFIED,
  DELETED,
}

export interface SnapshotDelta {
  // If true, .jj/working_copy/checkout have changed.
  stateChanged: boolean;
  // The current snapshot version. It must be monotonically increasing.
  snapshotVersion: number;
  fileChanges: FileChange[];
}

export interface FileChange {
  uri: vscode.Uri;
  type: FileChangeType;
}
