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

const MAX_CAS_REFETCH_RETRIES = 3;

/**
 * Coordinates authoritative repository state returned by `Client.getWorkspaceState`
 * so stale fetches cannot overwrite newer snapshots or concurrent mutations.
 */
export class WorkspaceStateManager {
  private state?: RepoAndWorkingCopyState;

  /**
   * Incremented on every accepted `setNewState` call to detect concurrent
   * mutations while an async `getWorkspaceState` call is in flight.
   */
  private stateGeneration = 0;

  private disposed = false;

  /** Ensures at most one `getWorkspaceState` request runs at a time. */
  private readonly executor = new SequentialExecutor();

  /** Pending `waitForInitialization()` resolvers settled on init or dispose. */
  private readonly waitForInitializationCbs: Array<(ok: boolean) => void> = [];

  constructor(private readonly client: Client) {}

  getState(): RepoAndWorkingCopyState | undefined {
    return this.state;
  }

  /**
   * Updates the stored state if `newState` advances the snapshot number (or
   * matches the current snapshot number when `allowEqualSnapshot` is true).
   *
   * @returns true if the stored state was updated.
   */
  setNewState(
    newState: RepoAndWorkingCopyState,
    options?: {allowEqualSnapshot?: boolean},
  ): boolean {
    if (this.disposed) {
      return false;
    }
    const allowEqual = options?.allowEqualSnapshot ?? false;
    if (
      this.state !== undefined &&
      (allowEqual
        ? newState.snapshotNumber < this.state.snapshotNumber
        : newState.snapshotNumber <= this.state.snapshotNumber)
    ) {
      return false;
    }

    this.state = newState;
    this.stateGeneration++;

    if (this.waitForInitializationCbs.length > 0) {
      const resolvers = this.waitForInitializationCbs.splice(0);
      for (const resolve of resolvers) {
        resolve(true);
      }
    }
    return true;
  }

  /**
   * Requests repository state at least as fresh as `snapshotNumber`.
   *
   * @param snapshotNumber Snapshot version to request from `Client`.
   * @param options.force When true, executes even if `snapshotNumber` equals
   *   the current snapshot number (used for non-file operation refreshes).
   * @returns true if this call updated the stored state.
   */
  async requestState(
    snapshotNumber: number,
    options?: {force?: boolean},
  ): Promise<boolean> {
    if (this.disposed) {
      return false;
    }
    const force = options?.force ?? false;
    if (
      this.state !== undefined &&
      (force
        ? snapshotNumber < this.state.snapshotNumber
        : snapshotNumber <= this.state.snapshotNumber)
    ) {
      return false;
    }

    const updated = await this.executor.execute({
      version: snapshotNumber,
      force,
      didCommit: (committed) => committed,
      fn: async (): Promise<boolean> => {
        for (let attempt = 0; attempt <= MAX_CAS_REFETCH_RETRIES; attempt++) {
          if (this.disposed) {
            return false;
          }
          if (
            this.state !== undefined &&
            (force
              ? snapshotNumber < this.state.snapshotNumber
              : snapshotNumber <= this.state.snapshotNumber)
          ) {
            return false;
          }

          const capturedGeneration = this.stateGeneration;
          // Provide the latest known operation ID (published or unpublished)
          // so backends that support incremental/fast-path checks can use it.
          const lastKnownUnpublishedOperation = this.state?.repoState.opHead;
          const repoState = await this.client.getWorkspaceState(
            snapshotNumber,
            lastKnownUnpublishedOperation,
          );

          if (this.disposed) {
            return false;
          }

          if (this.stateGeneration === capturedGeneration) {
            return this.setNewState(
              {snapshotNumber, repoState},
              {allowEqualSnapshot: force},
            );
          }

          // Snapshot staleness is re-checked at the top of the next iteration;
          // bail out immediately if a superseding job is already queued.
          if (this.executor.hasSupersedingQueuedJob(snapshotNumber, force)) {
            return false;
          }
        }
        return false;
      },
    });

    return updated ?? false;
  }

  /**
   * Resolves to `true` once the first authoritative state is stored, or
   * `false` if `dispose()` is called before initialization completes.
   */
  async waitForInitialization(): Promise<boolean> {
    if (this.state !== undefined) {
      return true;
    }
    if (this.disposed) {
      return false;
    }
    return new Promise<boolean>((resolve) => {
      this.waitForInitializationCbs.push(resolve);
    });
  }

  /**
   * Resolves once any in-flight or queued `requestState` execution finishes.
   */
  waitForIdle(): Promise<void> {
    return this.executor.waitForIdle();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.waitForInitializationCbs.length > 0) {
      const resolvers = this.waitForInitializationCbs.splice(0);
      for (const resolve of resolvers) {
        resolve(false);
      }
    }
  }
}
