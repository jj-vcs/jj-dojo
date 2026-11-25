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
import {Client} from '../client/client';
import {JjError} from '../error/error';
import {
  FileChangeType,
  FileSystemWatcher,
  SnapshotDelta,
} from '../file_system_watcher/file_system_watcher';
import {removeGlobalLogger, setGlobalLogger} from '../logging/logging';
import {OutputChannelLogger} from '../logging/output_channel_logger';
import {fakeCommit} from '../testing/fakes';
import {installVscode} from '../testing/install_vscode';
import {ChangeId, CommitId, FileId, OperationId, RepoState} from './api';
import {ApiImpl} from './api_impl';

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
  snapshotNumber = 1;
  private readonly listeners = new Set<
    (delta: SnapshotDelta | undefined) => void
  >();

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

  advanceSnapshotNumber(): number {
    return ++this.snapshotNumber;
  }

  emitDelta(delta: SnapshotDelta): void {
    this.snapshotNumber = delta.snapshotNumber;
    for (const cb of this.listeners) {
      cb(delta);
    }
  }
}

function createRepoState(opHex: string, commitHex: string): RepoState {
  return {
    opHead: new OperationId(opHex),
    commits: [
      fakeCommit({
        id: new CommitId(commitHex),
        changeId: new ChangeId(`chg-${commitHex}`),
        description: `desc-${opHex}`,
        active: true,
      }),
    ],
    conflictedFiles: [],
  };
}

describe('ApiImpl', () => {
  let client: jasmine.SpyObj<Client>;
  let watcher: FakeFileSystemWatcher;
  let api: ApiImpl | undefined;

  beforeEach(() => {
    installVscode();
    setGlobalLogger(new OutputChannelLogger());
    client = jasmine.createSpyObj<Client>('Client', [
      'getWorkspaceState',
      'readFileAtCommit',
      'readFileById',
    ]);
    watcher = new FakeFileSystemWatcher();
  });

  afterEach(async () => {
    if (api !== undefined) {
      await api.dispose();
      api = undefined;
    }
    removeGlobalLogger();
  });

  it('loads initial state, resolves waitUntilInitialized and getRepoState, and supports refresh() and file reads', async () => {
    const startupGate = createDeferred<RepoState>();
    client.getWorkspaceState.and.returnValue(startupGate.promise);

    api = new ApiImpl(client, watcher);
    expect(api.getRepoAndWorkingCopyState()).toBeUndefined();

    let changeEvents = 0;
    const sub = api.onStateChanged(() => {
      changeEvents++;
    });

    const repoStatePromise = api.getRepoState();
    await flushPromises();

    const initialRepo = createRepoState('op-1', 'commit-1');
    startupGate.resolve(initialRepo);

    expect(await api.initialStateLoaded).toBeTrue();
    expect(await repoStatePromise).toEqual(initialRepo);
    expect(changeEvents).toBe(1);

    // Subsequent waitUntilInitialized resolves immediately without extra events.
    await api.waitUntilInitialized();

    // Optimistic file event fires onStateChanged immediately, then authoritative state fires again.
    const refreshedRepo = createRepoState('op-2', 'commit-2');
    client.getWorkspaceState.and.resolveTo(refreshedRepo);
    watcher.emitDelta({
      snapshotNumber: 2,
      stateChanged: false,
      fileChanges: [{path: 'file.ts', type: FileChangeType.ADDED}],
    });
    await flushPromises();
    expect(changeEvents).toBe(3);

    // Explicit refresh() advances snapshotNumber to 3 and fetches latest state.
    const forcedRepo = createRepoState('op-3', 'commit-3');
    client.getWorkspaceState.and.resolveTo(forcedRepo);
    await api.refresh();
    expect(watcher.getCurrentSnapshotNumber()).toBe(3);
    expect(api.getRepoAndWorkingCopyState()?.repoState).toEqual(forcedRepo);

    // File read delegation preserves distinct parameters.
    const expectedBytes = new Uint8Array([1, 2, 3]);
    client.readFileAtCommit.and.resolveTo(expectedBytes);
    client.readFileById.and.resolveTo(new Uint8Array([9, 8]));

    expect(
      await api.readFileAtCommit(
        new CommitId('cid-read'),
        new OperationId('oid-read'),
        'dir/a.ts',
        {showParent: true},
      ),
    ).toEqual(expectedBytes);
    expect(client.readFileAtCommit).toHaveBeenCalledOnceWith(
      new CommitId('cid-read'),
      new OperationId('oid-read'),
      'dir/a.ts',
      {showParent: true},
    );

    expect(await api.readFileById(new FileId('fid-read'), 'dir/b.ts')).toEqual(
      new Uint8Array([9, 8]),
    );
    sub.dispose();
  });

  it('catches startup init() failures without unhandled rejections (E1) and recovers on subsequent watcher event', async () => {
    client.getWorkspaceState.and.rejectWith(new Error('initial cli failure'));

    api = new ApiImpl(client, watcher);
    expect(await api.initialStateLoaded).toBeFalse();
    expect(api.getRepoAndWorkingCopyState()).toBeUndefined();

    // Waiter registered while uninitialized resolves once a subsequent snapshot succeeds.
    const waiter = api.waitUntilInitialized();
    const recoveredRepo = createRepoState('op-recovered', 'commit-recovered');
    client.getWorkspaceState.and.resolveTo(recoveredRepo);

    watcher.emitDelta({
      snapshotNumber: 2,
      stateChanged: true,
      fileChanges: [],
    });
    await waiter;
    expect(await api.getRepoState()).toEqual(recoveredRepo);
  });

  it('rejects pending and post-dispose waitUntilInitialized / getRepoState callers with JjError on dispose() (E2)', async () => {
    const neverResolves = createDeferred<RepoState>();
    client.getWorkspaceState.and.returnValue(neverResolves.promise);

    api = new ApiImpl(client, watcher);
    const pendingWaiter = api.waitUntilInitialized();
    const pendingRepoState = api.getRepoState();
    await flushPromises();

    const disposePromise = api.dispose();
    await expectAsync(pendingWaiter).toBeRejectedWithError(
      JjError,
      /ApiImpl has been disposed/,
    );
    await expectAsync(pendingRepoState).toBeRejectedWithError(
      JjError,
      /ApiImpl has been disposed/,
    );

    // Unblock the in-flight RPC so waitForIdle() inside dispose() resolves cleanly.
    neverResolves.resolve(createRepoState('op-late', 'commit-late'));
    await disposePromise;
    expect(await api.initialStateLoaded).toBeFalse();

    // Post-dispose calls reject immediately rather than hanging on the disposed emitter.
    await expectAsync(api.waitUntilInitialized()).toBeRejectedWithError(
      JjError,
      /ApiImpl has been disposed/,
    );
    await expectAsync(api.getRepoState()).toBeRejectedWithError(
      JjError,
      /ApiImpl has been disposed/,
    );
  });
});
