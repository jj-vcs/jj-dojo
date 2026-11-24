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
import {Commit, RepoAndWorkingCopyState} from '../api/api';
import {Client} from '../client/client';
import {JjError} from '../error/error';
import {
  FileSystemWatcher,
  SnapshotDelta,
} from '../file_system_watcher/file_system_watcher';
import {logAndShowUserError, logError, logInfo} from '../logging/logging';
import {NetworkReconnectWatcher} from '../network_reconnect_watcher/network_reconnect_watcher';
import {OpHeadWatcher} from '../op_head_watcher/op_head_watcher';
import {dispose} from '../utils/dispose';
import {OptimisticStateEstimator} from './optimistic_state_estimator';
import {WorkspaceStateManager} from './workspace_state_manager';

/**
 * Configuration and optional host extension hooks for {@link ApiStateManager}.
 */
export interface ApiStateManagerOptions {
  readonly client: Client;
  readonly onDidChangeEmitter: vscode.EventEmitter<void>;
  readonly fileSystemWatcher: FileSystemWatcher;
  readonly opHeadWatcher?: OpHeadWatcher;
  /**
   * Optional callback invoked when `opHeadWatcher` signals a global operation
   * change. Defaults to `() => this.refresh()`.
   */
  readonly onOpHeadChanged?: () => Promise<void>;
  readonly networkReconnectWatcher?: NetworkReconnectWatcher;
  /**
   * Optional ignore predicate passed to {@link OptimisticStateEstimator} for
   * watchers that do not pre-filter ignored paths before emitting deltas.
   */
  readonly isIgnored?: (path: string) => boolean;
  /**
   * Optional pure projection applied on top of authoritative/optimistic state
   * (for example, merging code-review or CI metadata onto commits).
   */
  readonly transformState?: (
    state: RepoAndWorkingCopyState,
  ) => RepoAndWorkingCopyState;
  /**
   * Optional notification hook invoked after an `init()`, `refresh()`, or
   * `SnapshotDelta` state check completes while not disposed.
   */
  readonly onStateRefreshed?: (
    state: RepoAndWorkingCopyState | undefined,
    options: {forceUpdate: boolean},
  ) => void;
  /**
   * Optional custom error handler for non-network `getWorkspaceState` errors.
   * Return `true` if the error was suppressed without throwing, `false` to fall
   * through to `logAndShowUserError`, or rethrow to reject the caller.
   */
  readonly handleRequestStateError?: (
    error: JjError,
    snapshotNumber: number,
  ) => Promise<boolean>;
}

/**
 * Coordinates authoritative repository state (`WorkspaceStateManager`),
 * incremental file-watcher predictions (`OptimisticStateEstimator`), and
 * watcher lifecycle subscriptions for the extension API layer.
 */
export class ApiStateManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly workspaceStateManager: WorkspaceStateManager;
  private readonly optimisticStateEstimator: OptimisticStateEstimator;
  private readonly onDidChangeEmitter: vscode.EventEmitter<void>;
  private readonly fileSystemWatcher: FileSystemWatcher;
  private readonly transformState?: (
    state: RepoAndWorkingCopyState,
  ) => RepoAndWorkingCopyState;
  private readonly onStateRefreshed?: (
    state: RepoAndWorkingCopyState | undefined,
    options: {forceUpdate: boolean},
  ) => void;
  private readonly handleRequestStateError?: (
    error: JjError,
    snapshotNumber: number,
  ) => Promise<boolean>;

  /**
   * Tracks state objects previously exposed by `getRepoAndWorkingCopyState()`
   * or stored via `setNewState()` so no-op mutational actions that echo back
   * their input state (including optimistic states) cannot overwrite
   * authoritative metadata at the same snapshot number.
   */
  private readonly returnedStates = new WeakSet<RepoAndWorkingCopyState>();

  private isDisposed = false;

  constructor(options: ApiStateManagerOptions) {
    this.onDidChangeEmitter = options.onDidChangeEmitter;
    this.fileSystemWatcher = options.fileSystemWatcher;
    this.transformState = options.transformState;
    this.onStateRefreshed = options.onStateRefreshed;
    this.handleRequestStateError = options.handleRequestStateError;

    this.workspaceStateManager = new WorkspaceStateManager(options.client);
    this.optimisticStateEstimator = new OptimisticStateEstimator(
      options.isIgnored,
    );

    if (options.opHeadWatcher !== undefined) {
      const onOpHeadChanged =
        options.onOpHeadChanged ??
        (async () => {
          await this.refresh();
        });
      this.disposables.push(
        options.opHeadWatcher.subscribe(() => {
          if (this.isDisposed) {
            return;
          }
          void onOpHeadChanged().catch((err: unknown) => {
            if (!this.isDisposed) {
              logError(err);
            }
          });
        }),
      );
    }

    this.disposables.push(
      this.fileSystemWatcher.subscribe((snapshotDelta) => {
        if (this.isDisposed) {
          return;
        }
        void this.handleFileSystemUpdate(snapshotDelta).catch(
          (err: unknown) => {
            if (!this.isDisposed) {
              logError(err);
            }
          },
        );
      }),
    );

    if (options.networkReconnectWatcher !== undefined) {
      this.disposables.push(
        options.networkReconnectWatcher.subscribe(() => {
          if (this.isDisposed) {
            return;
          }
          void this.init().catch((err: unknown) => {
            if (!this.isDisposed) {
              logError(err);
            }
          });
        }),
      );
    }
  }

  /**
   * Loads repository state at `fileSystemWatcher.getCurrentSnapshotNumber()`
   * when newer than the currently committed snapshot.
   */
  async init(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    const currentSnapshot = this.fileSystemWatcher.getCurrentSnapshotNumber();
    const updated = await this.requestState(currentSnapshot);
    if (this.isDisposed) {
      return;
    }
    const latestBase = this.workspaceStateManager.getState();
    if (latestBase !== undefined) {
      this.returnedStates.add(latestBase);
    }
    if (updated) {
      this.onDidChangeEmitter.fire();
    }
    this.onStateRefreshed?.(latestBase, {forceUpdate: true});
  }

  /**
   * Forces an authoritative repository state refresh even when no local file
   * events occurred (for example, after an external operation-head update).
   */
  async refresh(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    const targetSnapshot = this.fileSystemWatcher.advanceSnapshotNumber
      ? this.fileSystemWatcher.advanceSnapshotNumber()
      : this.fileSystemWatcher.getCurrentSnapshotNumber();
    const updated = await this.requestState(targetSnapshot, {force: true});
    if (this.isDisposed) {
      return;
    }
    const latestBase = this.workspaceStateManager.getState();
    if (latestBase !== undefined) {
      this.returnedStates.add(latestBase);
    }
    if (updated) {
      this.onDidChangeEmitter.fire();
    }
    this.onStateRefreshed?.(latestBase, {forceUpdate: true});
  }

  /**
   * Stores a fresh backend state response directly (including non-file
   * mutations at an unchanged snapshot number) while ignoring echoed states
   * already returned to callers.
   */
  setNewState(newState: RepoAndWorkingCopyState): boolean {
    if (this.isDisposed || this.returnedStates.has(newState)) {
      return false;
    }
    const updated = this.workspaceStateManager.setNewState(newState, {
      allowEqualSnapshot: true,
    });
    if (updated) {
      this.returnedStates.add(newState);
    }
    return updated;
  }

  /**
   * Returns the latest authoritative repository state combined with any
   * consecutive optimistic file-change deltas and optional `transformState`
   * projection, or `undefined` prior to initialization.
   */
  getRepoAndWorkingCopyState(): RepoAndWorkingCopyState | undefined {
    const baseState = this.workspaceStateManager.getState();
    if (baseState === undefined) {
      return undefined;
    }
    this.returnedStates.add(baseState);

    let estimatedState = baseState;
    const oldWcCommit = baseState.repoState.commits.find((c) => c.active);
    if (oldWcCommit !== undefined) {
      const estimated = this.optimisticStateEstimator.getEstimatedWorkingCopy(
        baseState.snapshotNumber,
        oldWcCommit.files,
      );
      if (estimated !== undefined) {
        const estimatedWcCommit: Commit = {
          ...oldWcCommit,
          files: estimated.files,
        };
        estimatedState = {
          snapshotNumber: estimated.snapshotNumber,
          repoState: {
            ...baseState.repoState,
            commits: baseState.repoState.commits.map((c) =>
              c.active ? estimatedWcCommit : c,
            ),
          },
        };
      }
    }
    this.returnedStates.add(estimatedState);

    if (this.transformState === undefined) {
      return estimatedState;
    }
    const transformed = this.transformState(estimatedState);
    this.returnedStates.add(transformed);
    return transformed;
  }

  /**
   * Resolves to `true` once the initial repository state has loaded, or `false`
   * if `dispose()` runs before initialization completes.
   */
  waitUntilInitialized(): Promise<boolean> {
    return this.workspaceStateManager.waitForInitialization();
  }

  /**
   * Resolves once any in-flight or queued `getWorkspaceState` call settles.
   */
  waitForIdle(): Promise<void> {
    return this.workspaceStateManager.waitForIdle();
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    dispose(this.disposables);
    this.workspaceStateManager.dispose();
  }

  private async handleFileSystemUpdate(
    snapshotDelta: SnapshotDelta | undefined,
  ): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    if (snapshotDelta === undefined) {
      await this.init();
      return;
    }

    logInfo(
      `New file system snapshot available: ${snapshotDelta.snapshotNumber}`,
    );
    if (this.optimisticStateEstimator.add(snapshotDelta)) {
      this.onDidChangeEmitter.fire();
    }

    const updated = await this.requestState(snapshotDelta.snapshotNumber);
    if (this.isDisposed) {
      return;
    }
    const latestBase = this.workspaceStateManager.getState();
    if (latestBase !== undefined) {
      this.returnedStates.add(latestBase);
    }
    if (updated) {
      this.onDidChangeEmitter.fire();
    }
    this.onStateRefreshed?.(latestBase, {forceUpdate: false});
  }

  private async requestState(
    snapshotNumber: number,
    options?: {force?: boolean},
  ): Promise<boolean> {
    try {
      return await this.workspaceStateManager.requestState(
        snapshotNumber,
        options,
      );
    } catch (unparsedError: unknown) {
      if (this.isDisposed) {
        return false;
      }
      const err = JjError.from(unparsedError);
      if (err.isNetworkError) {
        // Mark transient network errors as already shown so laptop sleep or
        // offline transitions log without spamming user-visible error dialogs.
        err.isShownToUser = true;
        throw logError(err);
      }

      if (this.handleRequestStateError !== undefined) {
        try {
          const suppressed = await this.handleRequestStateError(
            err,
            snapshotNumber,
          );
          if (this.isDisposed || suppressed) {
            return false;
          }
        } catch (hookError: unknown) {
          if (this.isDisposed) {
            return false;
          }
          throw hookError;
        }
      }

      if (this.isDisposed) {
        return false;
      }
      throw logAndShowUserError(err);
    }
  }
}
