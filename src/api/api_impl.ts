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
import {Client} from '../client/client';
import {JjError} from '../error/error';
import {FileSystemWatcher} from '../file_system_watcher/file_system_watcher';
import {logAndShowInternalError} from '../logging/logging';
import {ApiStateManager} from '../state/api_state_manager';
import {
  Api,
  CommitId,
  FileId,
  OperationId,
  RepoAndWorkingCopyState,
  RepoState,
} from './api';

interface PendingInitWaiter {
  readonly disposable: vscode.Disposable;
  readonly reject: (err: JjError) => void;
}

export class ApiImpl implements Api, vscode.Disposable {
  private readonly onStateChangedEmitter = new vscode.EventEmitter<void>();
  readonly onStateChanged = this.onStateChangedEmitter.event;

  private readonly apiStateManager: ApiStateManager;
  private readonly pendingInitWaiters = new Set<PendingInitWaiter>();
  private isDisposed = false;

  /**
   * Resolves to `true` if the initial startup state load succeeds prior to
   * `dispose()`, or `false` if startup fails or `dispose()` runs first.
   */
  readonly initialStateLoaded: Promise<boolean>;

  constructor(
    private readonly client: Client,
    fileSystemWatcher: FileSystemWatcher,
  ) {
    this.apiStateManager = new ApiStateManager({
      client,
      onDidChangeEmitter: this.onStateChangedEmitter,
      fileSystemWatcher,
    });

    this.initialStateLoaded = this.apiStateManager.init().then(
      () => !this.isDisposed && this.isInitialized(),
      () => false,
    );
  }

  getRepoAndWorkingCopyState(): RepoAndWorkingCopyState | undefined {
    return this.apiStateManager.getRepoAndWorkingCopyState();
  }

  async getRepoState(): Promise<RepoState> {
    await this.waitUntilInitialized();
    const state = this.apiStateManager.getRepoAndWorkingCopyState();
    if (state === undefined) {
      throw logAndShowInternalError('Repo state is not initialized yet.');
    }
    return state.repoState;
  }

  async waitUntilInitialized(): Promise<void> {
    if (this.isDisposed) {
      throw new JjError('ApiImpl has been disposed');
    }
    if (this.isInitialized()) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const waiter: PendingInitWaiter = {
        disposable: this.onStateChanged(() => {
          if (this.isDisposed) {
            this.pendingInitWaiters.delete(waiter);
            waiter.disposable.dispose();
            reject(new JjError('ApiImpl has been disposed'));
            return;
          }
          if (this.isInitialized()) {
            this.pendingInitWaiters.delete(waiter);
            waiter.disposable.dispose();
            resolve();
          }
        }),
        reject,
      };

      if (this.isInitialized()) {
        waiter.disposable.dispose();
        resolve();
        return;
      }
      this.pendingInitWaiters.add(waiter);
    });
  }

  async refresh(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    await this.apiStateManager.refresh();
  }

  readFileAtCommit(
    commitId: CommitId,
    opId: OperationId | undefined,
    workspacePath: string,
    options: {showParent: boolean},
  ): Promise<Uint8Array | undefined> {
    return this.client.readFileAtCommit(commitId, opId, workspacePath, options);
  }

  readFileById(fileId: FileId, workspacePath: string): Promise<Uint8Array> {
    return this.client.readFileById(fileId, workspacePath);
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;

    if (this.pendingInitWaiters.size > 0) {
      const waiters = [...this.pendingInitWaiters];
      this.pendingInitWaiters.clear();
      const disposedError = new JjError('ApiImpl has been disposed');
      for (const waiter of waiters) {
        waiter.disposable.dispose();
        waiter.reject(disposedError);
      }
    }

    this.apiStateManager.dispose();
    this.onStateChangedEmitter.dispose();
    await this.apiStateManager.waitForIdle();
  }

  private isInitialized(): boolean {
    return this.apiStateManager.getRepoAndWorkingCopyState() !== undefined;
  }
}
