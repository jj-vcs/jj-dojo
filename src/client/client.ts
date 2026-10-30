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
  OperationId,
  RepoState,
  WorkingCopy,
  CommitId,
  FileId,
} from '../api/api';

/**
 * An abstract interface for interacting with JJ.
 */
export interface Client {
  /**
   * Snapshots the working copy without publishing an operation, and returns
   * the resulting repo state.
   *
   * @param snapshotNumber The snapshot number provided by the file system.
   * See also SnapshotDelta.snapshotNumber. If provided, the implementation
   * should return the file system's state at that snapshot if possible.
   * @param lastKnownUnpublishedOperation The last known unpublished operation.
   * The JJ extension does unpublished snapshot to avoid adding entries to users
   * op log, or racing with other operations and causing divergence. However, one
   * caveat with this approach is, JJ never memorizes the last snapshotted state
   * (since it was unpublished), and would repeatedly try to snapshot the same set
   * of files, and this has caused resource exhaustion issues internally inside
   * Google. To work around that, the vscode extension memorizes the last known
   * unpublished operation, and provides it to the jj server so it can use that
   * as the base version to snapshot on top of. The JJ CLI does not support this,
   * so its implementation should just ignore this field.
   */
  getWorkspaceState(
    snapshotNumber?: number,
    lastKnownUnpublishedOperation?: OperationId,
  ): Promise<RepoState>;

  /**
   * Reads the contents of a file at the specified commit or at its combined
   * parents.
   *
   * @param source The commit ID to read from.
   * @param workspacePath The path to the file, relative to the workspace root.
   * @param opHead The operation ID that is able to reach `source` (e.g.
   *   `RepoState.opHead`). In the JJ Git Backend, `jj file show -r <commit_id>`
   *   only works if the associated operation provided by `--at-op` (or head if
   *   not provided) is able to reach the commit. See
   *   https://discord.com/channels/968932220549103686/1562643664075886704 for
   *   context. For the Google internal commit-cloud implementation, this field
   *   may be unused.
   * @param options.showParent If true, reads the file at the version of
   *   `source`'s combined parents (for a merge commit with multiple parents,
   *   this is the automatic merge of all parents). If false, reads the file at `source`.
   * @return The file contents as bytes, or `undefined` if the file does not
   *   exist at the requested revision.
   */
  readFileAtCommit(
    source: CommitId,
    workspacePath: string,
    opHead: OperationId,
    options: {showParent: boolean},
  ): Promise<Uint8Array | undefined>;

  /**
   * Reads a file by its FileId.
   */
  readFileById(source: FileId, workspacePath: string): Promise<Uint8Array>;

  /**
   * The equivalent of `jj workspace add <workspaceRoot>`.
   */
  workspaceAdd(workspaceRoot: string): Promise<WorkingCopy>;
}
