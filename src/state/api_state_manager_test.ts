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

import 'jasmine';
import * as vscode from 'vscode';
import {
  ChangeId,
  CommitFile,
  CommitId,
  FileId,
  ModificationType,
  OperationId,
  RepoAndWorkingCopyState,
  RepoState,
} from '../api/api';
import {Client} from '../client/client';
import {JjError} from '../error/error';
import {
  FileChangeType,
  FileSystemWatcher,
  SnapshotDelta,
} from '../file_system_watcher/file_system_watcher';
import {removeGlobalLogger, setGlobalLogger} from '../logging/logging';
import {OutputChannelLogger} from '../logging/output_channel_logger';
import {NetworkReconnectWatcher} from '../network_reconnect_watcher/network_reconnect_watcher';
import {OpHeadWatcher} from '../op_head_watcher/op_head_watcher';
import {fakeCommit} from '../testing/fakes';
import {fakeVscode, installVscode, logs} from '../testing/install_vscode';
import {Merge} from '../utils/merge';
import {ApiStateManager} from './api_state_manager';

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

class FakeFileSystemWatcher implements FileSystemWatcher {
  snapshotNumber = 10;
  private readonly listeners = new Set<
    (delta: SnapshotDelta | undefined) => void
  >();
  readonly withAdvance: boolean;

  constructor(options?: {withAdvance?: boolean; initialSnapshot?: number}) {
    this.withAdvance = options?.withAdvance ?? true;
    this.snapshotNumber = options?.initialSnapshot ?? 10;
    if (!this.withAdvance) {
      this.advanceSnapshotNumber = undefined;
    }
  }

  subscribe(
    cb: (snapshotDelta: SnapshotDelta | undefined) => void,
  ): vscode.Disposable {
    this.listeners.add(cb);
    return {
      dispose: () => {
        this.listeners.delete(cb);
      },
    };
  }

  getCurrentSnapshotNumber(): number {
    return this.snapshotNumber;
  }

  advanceSnapshotNumber?: () => number = () => {
    return ++this.snapshotNumber;
  };

  emitDelta(delta: SnapshotDelta): void {
    this.snapshotNumber = delta.snapshotNumber;
    for (const cb of this.listeners) {
      cb(delta);
    }
  }

  emitUndefined(nextSnapshot?: number): void {
    if (nextSnapshot !== undefined) {
      this.snapshotNumber = nextSnapshot;
    }
    for (const cb of this.listeners) {
      cb(undefined);
    }
  }
}

class FakeSignalWatcher implements OpHeadWatcher, NetworkReconnectWatcher {
  private readonly listeners = new Set<() => void>();

  subscribe(cb: () => void): vscode.Disposable {
    this.listeners.add(cb);
    return {
      dispose: () => {
        this.listeners.delete(cb);
      },
    };
  }

  emit(): void {
    for (const cb of this.listeners) {
      cb();
    }
  }
}

function createRepoState(options: {
  opHex: string;
  commitHex: string;
  description?: string;
  files?: CommitFile[];
}): RepoState {
  return {
    opHead: new OperationId(options.opHex),
    commits: [
      fakeCommit({
        id: new CommitId(options.commitHex),
        changeId: new ChangeId(`chg-${options.commitHex}`),
        description: options.description ?? `desc-${options.opHex}`,
        active: true,
        files: options.files ?? [],
      }),
    ],
    conflictedFiles: [],
  };
}

describe('ApiStateManager', () => {
  let client: jasmine.SpyObj<Client>;
  let onDidChangeEmitter: vscode.EventEmitter<void>;
  let fireSpy: jasmine.Spy;
  let fsWatcher: FakeFileSystemWatcher;
  let opHeadWatcher: FakeSignalWatcher;
  let reconnectWatcher: FakeSignalWatcher;
  let manager: ApiStateManager | undefined;

  beforeEach(() => {
    installVscode();
    setGlobalLogger(new OutputChannelLogger());
    client = jasmine.createSpyObj<Client>('Client', ['getWorkspaceState']);
    onDidChangeEmitter = new vscode.EventEmitter<void>();
    fireSpy = spyOn(onDidChangeEmitter, 'fire').and.callThrough();
    fsWatcher = new FakeFileSystemWatcher({
      withAdvance: true,
      initialSnapshot: 10,
    });
    opHeadWatcher = new FakeSignalWatcher();
    reconnectWatcher = new FakeSignalWatcher();
  });

  afterEach(async () => {
    if (manager !== undefined) {
      manager.dispose();
      await manager.waitForIdle();
      manager = undefined;
    }
    onDidChangeEmitter.dispose();
    removeGlobalLogger();
  });

  it('initializes at current snapshot, emits two-phase optimistic/authoritative updates, and skips buffering on stateChanged', async () => {
    const refreshEvents: Array<{
      snapshot: number | undefined;
      forceUpdate: boolean;
    }> = [];

    manager = new ApiStateManager({
      client,
      onDidChangeEmitter,
      fileSystemWatcher: fsWatcher,
      onStateRefreshed: (state, opts) => {
        refreshEvents.push({
          snapshot: state?.snapshotNumber,
          forceUpdate: opts.forceUpdate,
        });
      },
    });

    const baseFiles: CommitFile[] = [
      {
        path: 'existing.ts',
        modificationType: ModificationType.ADDED,
        mergedFileMetadata: Merge.fromResolved({
          fileId: new FileId('fid-existing'),
        }),
      },
    ];
    client.getWorkspaceState.and.resolveTo(
      createRepoState({
        opHex: 'op-root',
        commitHex: 'commit-root',
        files: baseFiles,
      }),
    );

    const initWaiter = manager.waitUntilInitialized();
    await manager.init();
    expect(await initWaiter).toBeTrue();
    expect(client.getWorkspaceState).toHaveBeenCalledOnceWith(10, undefined);
    expect(fireSpy).toHaveBeenCalledTimes(1);
    expect(refreshEvents).toEqual([{snapshot: 10, forceUpdate: true}]);

    // Emit SnapshotDelta 11 with stateChanged: false while holding RPC 11 open.
    const rpc11 = createDeferred<RepoState>();
    client.getWorkspaceState.calls.reset();
    fireSpy.calls.reset();
    refreshEvents.length = 0;
    client.getWorkspaceState.and.returnValue(rpc11.promise);

    fsWatcher.emitDelta({
      snapshotNumber: 11,
      stateChanged: false,
      fileChanges: [{path: 'draft.ts', type: FileChangeType.ADDED}],
    });

    // Immediate 1st emission carries optimistic file change before RPC 11 resolves.
    expect(fireSpy).toHaveBeenCalledTimes(1);
    const optimisticState = manager.getRepoAndWorkingCopyState();
    expect(optimisticState?.snapshotNumber).toBe(11);
    const optimisticWc = optimisticState?.repoState.commits.find(
      (c) => c.active,
    );
    expect(optimisticWc?.files).toEqual([
      baseFiles[0],
      {
        path: 'draft.ts',
        modificationType: ModificationType.UNKNOWN,
        mergedFileMetadata: Merge.fromResolved({}),
      },
    ]);

    const authFiles11: CommitFile[] = [
      ...baseFiles,
      {
        path: 'draft.ts',
        modificationType: ModificationType.ADDED,
        mergedFileMetadata: Merge.fromResolved({
          fileId: new FileId('fid-draft'),
        }),
      },
    ];
    rpc11.resolve(
      createRepoState({
        opHex: 'op-11',
        commitHex: 'commit-11',
        files: authFiles11,
      }),
    );
    await flushPromises();

    expect(client.getWorkspaceState).toHaveBeenCalledOnceWith(
      11,
      new OperationId('op-root'),
    );
    expect(fireSpy).toHaveBeenCalledTimes(2);
    expect(refreshEvents).toEqual([{snapshot: 11, forceUpdate: false}]);
    expect(
      manager.getRepoAndWorkingCopyState()?.repoState.commits[0].files,
    ).toEqual(authFiles11);

    // Emit SnapshotDelta 12 with stateChanged: true -> skips optimistic fire (only 1 fire on RPC completion).
    fireSpy.calls.reset();
    client.getWorkspaceState.calls.reset();
    client.getWorkspaceState.and.resolveTo(
      createRepoState({opHex: 'op-12', commitHex: 'commit-12', files: []}),
    );
    fsWatcher.emitDelta({
      snapshotNumber: 12,
      stateChanged: true,
      fileChanges: [{path: 'draft.ts', type: FileChangeType.DELETED}],
    });
    expect(fireSpy).toHaveBeenCalledTimes(0);
    await flushPromises();
    expect(fireSpy).toHaveBeenCalledTimes(1);
    expect(manager.getRepoAndWorkingCopyState()?.snapshotNumber).toBe(12);
  });

  it('makes 0 RPCs on networkReconnectWatcher when snapshot is unchanged while invoking onStateRefreshed(forceUpdate: true)', async () => {
    const refreshCalls: Array<{forceUpdate: boolean}> = [];
    manager = new ApiStateManager({
      client,
      onDidChangeEmitter,
      fileSystemWatcher: fsWatcher,
      networkReconnectWatcher: reconnectWatcher,
      onStateRefreshed: (_state, opts) => {
        refreshCalls.push(opts);
      },
    });

    client.getWorkspaceState.and.resolveTo(
      createRepoState({opHex: 'op-10', commitHex: 'commit-10'}),
    );
    await manager.init();

    client.getWorkspaceState.calls.reset();
    fireSpy.calls.reset();
    refreshCalls.length = 0;

    // Reconnect at unchanged snapshot 10 -> 0 RPCs, 0 fires, 1 onStateRefreshed(forceUpdate: true).
    reconnectWatcher.emit();
    await flushPromises();
    expect(client.getWorkspaceState).not.toHaveBeenCalled();
    expect(fireSpy).not.toHaveBeenCalled();
    expect(refreshCalls).toEqual([{forceUpdate: true}]);

    // Reconnect after snapshot advances to 11 -> 1 RPC, 1 fire, 1 onStateRefreshed(forceUpdate: true).
    fsWatcher.snapshotNumber = 11;
    client.getWorkspaceState.and.resolveTo(
      createRepoState({opHex: 'op-11', commitHex: 'commit-11'}),
    );
    reconnectWatcher.emit();
    await flushPromises();
    expect(client.getWorkspaceState).toHaveBeenCalledOnceWith(
      11,
      new OperationId('op-10'),
    );
    expect(fireSpy).toHaveBeenCalledTimes(1);
    expect(refreshCalls.length).toBe(2);

    // Undefined watcher notification at snapshot 13 also triggers init().
    client.getWorkspaceState.calls.reset();
    client.getWorkspaceState.and.resolveTo(
      createRepoState({opHex: 'op-13', commitHex: 'commit-13'}),
    );
    fsWatcher.emitUndefined(13);
    await flushPromises();
    expect(client.getWorkspaceState).toHaveBeenCalledOnceWith(
      13,
      new OperationId('op-11'),
    );
  });

  it('refreshes on opHeadWatcher using advanceSnapshotNumber or equal-snapshot force when advanceSnapshotNumber is absent', async () => {
    // Case 1: Watcher WITH advanceSnapshotNumber().
    manager = new ApiStateManager({
      client,
      onDidChangeEmitter,
      fileSystemWatcher: fsWatcher,
      opHeadWatcher,
    });
    client.getWorkspaceState.and.resolveTo(
      createRepoState({opHex: 'op-init', commitHex: 'commit-init'}),
    );
    await manager.init();

    client.getWorkspaceState.calls.reset();
    client.getWorkspaceState.and.resolveTo(
      createRepoState({opHex: 'op-external', commitHex: 'commit-external'}),
    );
    opHeadWatcher.emit();
    await flushPromises();

    expect(fsWatcher.getCurrentSnapshotNumber()).toBe(11);
    expect(client.getWorkspaceState).toHaveBeenCalledOnceWith(
      11,
      new OperationId('op-init'),
    );
    expect(manager.getRepoAndWorkingCopyState()?.repoState.opHead.hex).toBe(
      'op-external',
    );
    manager.dispose();

    // Case 2: Virtual watcher WITHOUT advanceSnapshotNumber() refreshes at equal snapshot 20.
    const virtualWatcher = new FakeFileSystemWatcher({
      withAdvance: false,
      initialSnapshot: 20,
    });
    const customOpHooks: string[] = [];
    manager = new ApiStateManager({
      client,
      onDidChangeEmitter,
      fileSystemWatcher: virtualWatcher,
      opHeadWatcher,
      onOpHeadChanged: async () => {
        customOpHooks.push('triggered');
        await manager!.refresh();
      },
    });
    client.getWorkspaceState.calls.reset();
    client.getWorkspaceState.and.resolveTo(
      createRepoState({opHex: 'op-v20-a', commitHex: 'commit-v20-a'}),
    );
    await manager.init();

    client.getWorkspaceState.calls.reset();
    client.getWorkspaceState.and.resolveTo(
      createRepoState({opHex: 'op-v20-b', commitHex: 'commit-v20-b'}),
    );
    opHeadWatcher.emit();
    await flushPromises();

    expect(customOpHooks).toEqual(['triggered']);
    expect(client.getWorkspaceState).toHaveBeenCalledOnceWith(
      20,
      new OperationId('op-v20-a'),
    );
    expect(manager.getRepoAndWorkingCopyState()?.repoState.opHead.hex).toBe(
      'op-v20-b',
    );
  });

  it('rejects echoed states via WeakSet in setNewState while accepting genuine same-snapshot backend mutations', async () => {
    manager = new ApiStateManager({
      client,
      onDidChangeEmitter,
      fileSystemWatcher: fsWatcher,
      isIgnored: (p) => p.endsWith('.ignored'),
      transformState: (s) => ({
        ...s,
        repoState: {
          ...s.repoState,
          commits: s.repoState.commits.map((c) => ({
            ...c,
            descriptionTitle: `[decorated] ${c.descriptionTitle}`,
          })),
        },
      }),
    });

    const authoritativeFile: CommitFile = {
      path: 'tracked.ts',
      modificationType: ModificationType.MODIFIED,
      mergedFileMetadata: Merge.fromResolved({
        fileId: new FileId('fid-authoritative-10'),
      }),
    };
    client.getWorkspaceState.and.resolveTo(
      createRepoState({
        opHex: 'op-10',
        commitHex: 'commit-10',
        description: 'initial title',
        files: [authoritativeFile],
      }),
    );
    await manager.init();

    // Hold RPC 11 open so getRepoAndWorkingCopyState() returns an optimistic + transformed state.
    const pending11 = createDeferred<RepoState>();
    client.getWorkspaceState.and.returnValue(pending11.promise);
    fsWatcher.emitDelta({
      snapshotNumber: 11,
      stateChanged: false,
      fileChanges: [
        {path: 'tracked.ts', type: FileChangeType.MODIFIED},
        {path: 'temp.ignored', type: FileChangeType.ADDED},
      ],
    });

    const echoedOptimisticState = manager.getRepoAndWorkingCopyState()!;
    expect(echoedOptimisticState.snapshotNumber).toBe(11);
    expect(echoedOptimisticState.repoState.commits[0].descriptionTitle).toBe(
      '[decorated] initial title',
    );
    // Optimistic file lacks FileId, and temp.ignored was filtered by isIgnored.
    expect(echoedOptimisticState.repoState.commits[0].files).toEqual([
      {
        path: 'tracked.ts',
        modificationType: ModificationType.MODIFIED,
        mergedFileMetadata: Merge.fromResolved({}),
      },
    ]);

    // Simulate a no-op action echoing back `echoedOptimisticState`: MUST be rejected!
    expect(manager.setNewState(echoedOptimisticState)).toBeFalse();

    // Finish RPC 11 with authoritative FileId.
    pending11.resolve(
      createRepoState({
        opHex: 'op-11',
        commitHex: 'commit-11',
        description: 'initial title',
        files: [
          {
            path: 'tracked.ts',
            modificationType: ModificationType.MODIFIED,
            mergedFileMetadata: Merge.fromResolved({
              fileId: new FileId('fid-authoritative-11'),
            }),
          },
        ],
      }),
    );
    await flushPromises();

    // Authoritative FileId at 11 was NOT clobbered by the optimistic echo.
    const post11State = manager.getRepoAndWorkingCopyState()!;
    expect(
      post11State.repoState.commits[0].files[0].mergedFileMetadata,
    ).toEqual(Merge.fromResolved({fileId: new FileId('fid-authoritative-11')}));
    expect(manager.setNewState(post11State)).toBeFalse();

    // Now pass a genuine same-snapshot backend mutation response at snapshot 11: MUST succeed!
    const describeResponse: RepoAndWorkingCopyState = {
      snapshotNumber: 11,
      repoState: createRepoState({
        opHex: 'op-11-described',
        commitHex: 'commit-11-described',
        description: 'updated commit message',
        files: post11State.repoState.commits[0].files,
      }),
    };
    expect(manager.setNewState(describeResponse)).toBeTrue();
    // Calling setNewState a second time with the same response object is rejected as an echo.
    expect(manager.setNewState(describeResponse)).toBeFalse();
    expect(
      manager.getRepoAndWorkingCopyState()?.repoState.commits[0]
        .descriptionTitle,
    ).toBe('[decorated] updated commit message');
  });

  it('handles network errors, non-network errors, custom error hooks, watcher rejections, and post-dispose suppression', async () => {
    let customHookCalls = 0;
    manager = new ApiStateManager({
      client,
      onDidChangeEmitter,
      fileSystemWatcher: fsWatcher,
      opHeadWatcher,
      networkReconnectWatcher: reconnectWatcher,
      handleRequestStateError: async (err, snapshot) => {
        customHookCalls++;
        if (err.message.includes('suppressed-transient')) {
          return true;
        }
        if (err.message.includes('delayed-reject')) {
          throw new JjError(`hook-rejected-${snapshot}`);
        }
        return false;
      },
    });

    // 1. Network error: rejects init() without showing user error message.
    const netErr = new JjError('Connection reset');
    netErr.isNetworkError = true;
    client.getWorkspaceState.and.rejectWith(netErr);
    await expectAsync(manager.init()).toBeRejected();
    expect(fakeVscode().window.showErrorMessage).not.toHaveBeenCalled();
    expect(customHookCalls).toBe(0);

    // 2. Non-network unhandled error: falls through hook (returns false) and calls showErrorMessage.
    client.getWorkspaceState.and.rejectWith(new Error('fatal repo error'));
    await expectAsync(manager.init()).toBeRejected();
    expect(fakeVscode().window.showErrorMessage).toHaveBeenCalledOnceWith(
      'fatal repo error',
      jasmine.anything(),
    );
    expect(customHookCalls).toBe(1);

    // 3. Custom hook suppresses error cleanly (`init()` resolves without firing).
    fakeVscode().window.showErrorMessage.calls.reset();
    client.getWorkspaceState.and.rejectWith(
      new Error('suppressed-transient failure'),
    );
    await expectAsync(manager.init()).toBeResolved();
    expect(fakeVscode().window.showErrorMessage).not.toHaveBeenCalled();

    // 4. Watcher callback rejections are caught and logged without unhandled promise rejections.
    client.getWorkspaceState.and.rejectWith(new Error('delayed-reject'));
    reconnectWatcher.emit();
    opHeadWatcher.emit();
    await flushPromises();
    expect(
      logs().messages.some(
        (m) => m[0] === 'ERROR' && String(m[1]).includes('hook-rejected-'),
      ),
    ).toBeTrue();

    // 5. Disposing while a request is in flight settles waitUntilInitialized to false
    // and suppresses error dialogs/emissions when the late RPC rejects.
    fakeVscode().window.showErrorMessage.calls.reset();
    fireSpy.calls.reset();
    const lateRpc = createDeferred<RepoState>();
    client.getWorkspaceState.and.returnValue(lateRpc.promise);

    const pendingWaiter = manager.waitUntilInitialized();
    const inflightInit = manager.init();
    await flushPromises();

    manager.dispose();
    expect(await pendingWaiter).toBeFalse();

    lateRpc.reject(new Error('post-dispose explosion'));
    await expectAsync(inflightInit).toBeResolved();
    await manager.waitForIdle();
    expect(fakeVscode().window.showErrorMessage).not.toHaveBeenCalled();
    expect(fireSpy).not.toHaveBeenCalled();
  });
});
