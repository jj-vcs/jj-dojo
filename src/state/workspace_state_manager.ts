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

import {RepoAndWorkingCopyState} from '../api/api';
import {Client} from '../client/client';
import {SequentialExecutor} from '../utils/sequential_executor';

/**
 * Manages the state of the workspace returned by GetWorkspaceState.
 *
 * This class is responsible for ensuring that the old state never overwrites
 * new state.
 */
export class WorkspaceStateManager {
  private state?: RepoAndWorkingCopyState;

  /**
   * An executor that ensures we only send one GetWorkspaceState request at a
   * time.
   */
  private readonly executor = new SequentialExecutor();

  /** Callbacks to be called when the state is initialized. */
  private readonly waitForInitializationCbs: Array<() => void> = [];

  constructor(private readonly client: Client) {}

  getState(): RepoAndWorkingCopyState | undefined {
    return this.state;
  }

  /**
   * Updates the internal state if the provided state is newer.
   *
   * @return true if the state has been updated.
   */
  setNewState(newState: RepoAndWorkingCopyState): boolean {
    if (
      this.state !== undefined &&
      newState.snapshotNumber <= this.state.snapshotNumber
    ) {
      return false;
    }
    this.state = newState;
    for (const cb of this.waitForInitializationCbs) {
      cb();
    }
    this.waitForInitializationCbs.length = 0;
    return true;
  }

  /**
   * Requests the state of the repo at least as fresh as the given citc snapshot
   * number.
   *
   * @return true if the state has been updated.
   */
  async requestState(citcSnapshotNumber: number): Promise<boolean> {
    const state = await this.executor.execute({
      version: citcSnapshotNumber,
      fn: async () => {
        // This operation can be an unpublished or a published operation.
        // Just provide that to the server. The server is smart enough to
        // use it only when it's helpful.
        const lastKnownUnpublishedOperation = this.state?.repoState.opHead;
        return {
          snapshotNumber: citcSnapshotNumber,
          repoState: await this.client.getWorkspaceState(
            citcSnapshotNumber,
            lastKnownUnpublishedOperation,
          ),
        };
      },
    });
    if (!state) {
      return false;
    }
    return this.setNewState(state);
  }

  async waitForInitialization(): Promise<void> {
    if (this.state) {
      // Already initialized.
      return;
    }
    return new Promise((resolve) => {
      this.waitForInitializationCbs.push(() => {
        resolve();
      });
    });
  }
}
