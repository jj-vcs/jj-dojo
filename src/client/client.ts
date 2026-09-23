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

import {OperationId, RepoState} from '../api/api';

/**
 * An abstract interface for interacting with JJ.
 */
export interface Client {
  /**
   *
   * @param snapshotNumber The snapshot number provided by the file system.
   * See also FileSystemWatcher.snapshotNumber. If provided, the implementation
   * should return the file system's state at that snapshot, if possible.
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
}
