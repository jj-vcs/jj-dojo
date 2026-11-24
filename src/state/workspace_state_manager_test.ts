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
import {
  ChangeId,
  CommitId,
  OperationId,
  RepoAndWorkingCopyState,
  RepoState,
} from '../api/api';
import {Client} from '../client/client';
import {fakeCommit} from '../testing/fakes';
import {WorkspaceStateManager} from './workspace_state_manager';

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

function createWorkspaceState(
  snapshotNumber: number,
  opHex: string,
  commitHex: string,
): RepoAndWorkingCopyState {
  return {
    snapshotNumber,
    repoState: createRepoState(opHex, commitHex),
  };
}

describe('WorkspaceStateManager', () => {
  let client: jasmine.SpyObj<Client>;
  let manager: WorkspaceStateManager;

  beforeEach(() => {
    client = jasmine.createSpyObj<Client>('Client', ['getWorkspaceState']);
    manager = new WorkspaceStateManager(client);
  });

  afterEach(() => {
    manager.dispose();
  });

  it('starts uninitialized and resolves waitForInitialization to true once state is set', async () => {
    expect(manager.getState()).toBeUndefined();

    let initResult: boolean | undefined;
    const waitPromise = manager.waitForInitialization().then((ok) => {
      initResult = ok;
      return ok;
    });
    await flushPromises();
    expect(initResult).toBeUndefined();

    const firstState = createWorkspaceState(10, 'op-10', 'commit-10');
    expect(manager.setNewState(firstState)).toBeTrue();
    expect(manager.getState()).toBe(firstState);
    expect(await waitPromise).toBeTrue();
    expect(await manager.waitForInitialization()).toBeTrue();
  });

  it('settles pending waitForInitialization to false on dispose and blocks further mutations', async () => {
    const waiter1 = manager.waitForInitialization();
    const waiter2 = manager.waitForInitialization();

    manager.dispose();

    expect(await waiter1).toBeFalse();
    expect(await waiter2).toBeFalse();
    expect(await manager.waitForInitialization()).toBeFalse();
    expect(
      manager.setNewState(createWorkspaceState(1, 'op-1', 'commit-1')),
    ).toBeFalse();
    expect(await manager.requestState(1)).toBeFalse();
  });

  describe('setNewState', () => {
    it('rejects equal or older snapshotNumber by default and accepts equal only with allowEqualSnapshot', () => {
      const state10a = createWorkspaceState(10, 'op-10a', 'commit-10a');
      const state10b = createWorkspaceState(10, 'op-10b', 'commit-10b');
      const state9 = createWorkspaceState(9, 'op-9', 'commit-9');
      const state11 = createWorkspaceState(11, 'op-11', 'commit-11');

      expect(manager.setNewState(state10a)).toBeTrue();
      expect(manager.setNewState(state10b)).toBeFalse();
      expect(manager.getState()).toBe(state10a);

      expect(
        manager.setNewState(state10b, {allowEqualSnapshot: true}),
      ).toBeTrue();
      expect(manager.getState()).toBe(state10b);

      expect(
        manager.setNewState(state9, {allowEqualSnapshot: true}),
      ).toBeFalse();
      expect(manager.getState()).toBe(state10b);

      expect(manager.setNewState(state11)).toBeTrue();
      expect(manager.getState()).toBe(state11);
    });
  });

  describe('requestState', () => {
    it('commits state inside fn and forwards updated opHead across coalesced bursts', async () => {
      const call1 = createDeferred<RepoState>();
      const call3 = createDeferred<RepoState>();

      client.getWorkspaceState.and.callFake((snapshotNumber) => {
        if (snapshotNumber === 1) {
          return call1.promise;
        }
        if (snapshotNumber === 3) {
          return call3.promise;
        }
        throw new Error(`Unexpected snapshotNumber ${snapshotNumber}`);
      });

      const req1 = manager.requestState(1);
      await flushPromises();
      const req2 = manager.requestState(2);
      const req3 = manager.requestState(3);

      expect(await req2).toBeFalse();
      expect(client.getWorkspaceState).toHaveBeenCalledTimes(1);
      expect(client.getWorkspaceState.calls.argsFor(0)).toEqual([1, undefined]);

      const repo1 = createRepoState('op-alpha', 'commit-alpha');
      call1.resolve(repo1);
      expect(await req1).toBeTrue();
      await flushPromises();

      expect(client.getWorkspaceState).toHaveBeenCalledTimes(2);
      expect(client.getWorkspaceState.calls.argsFor(1)).toEqual([
        3,
        new OperationId('op-alpha'),
      ]);

      const repo3 = createRepoState('op-gamma', 'commit-gamma');
      call3.resolve(repo3);
      expect(await req3).toBeTrue();
      expect(manager.getState()).toEqual({
        snapshotNumber: 3,
        repoState: repo3,
      });
    });

    it('re-fetches with fresh opHead when a concurrent mutation lands mid-flight for a newer snapshot (CP1 & CP2)', async () => {
      const initial = createWorkspaceState(10, 'op-10', 'commit-10');
      manager.setNewState(initial);

      const staleFetch11 = createDeferred<RepoState>();
      const freshRepo11 = createRepoState('op-11-fresh', 'commit-11-fresh');
      let calls = 0;
      client.getWorkspaceState.and.callFake(async () => {
        calls++;
        if (calls === 1) {
          return staleFetch11.promise;
        }
        return freshRepo11;
      });

      // Normal non-forced requestState(11) starts at stateGeneration 1.
      const req11 = manager.requestState(11);
      await flushPromises();
      expect(client.getWorkspaceState.calls.argsFor(0)).toEqual([
        11,
        new OperationId('op-10'),
      ]);

      // Concurrent same-snapshot action mutates state at snapshot 10.
      const mutated10 = createWorkspaceState(
        10,
        'op-10-action',
        'commit-10-action',
      );
      expect(
        manager.setNewState(mutated10, {allowEqualSnapshot: true}),
      ).toBeTrue();

      // Resolve stale pre-action RPC: must NOT clobber op-10-action; must re-fetch!
      staleFetch11.resolve(createRepoState('op-11-stale', 'commit-11-stale'));
      expect(await req11).toBeTrue();

      expect(client.getWorkspaceState).toHaveBeenCalledTimes(2);
      expect(client.getWorkspaceState.calls.argsFor(1)).toEqual([
        11,
        new OperationId('op-10-action'),
      ]);
      expect(manager.getState()).toEqual({
        snapshotNumber: 11,
        repoState: freshRepo11,
      });
    });

    it('re-fetches forced equal-snapshot refresh on concurrent CAS mismatch (CP4a & CP4b)', async () => {
      const initial = createWorkspaceState(10, 'op-10-base', 'commit-10-base');
      manager.setNewState(initial);

      const staleRefresh10 = createDeferred<RepoState>();
      const freshRepo10 = createRepoState('op-10-refreshed', 'commit-10-ref');
      let callCount = 0;
      client.getWorkspaceState.and.callFake(async () => {
        callCount++;
        if (callCount === 1) {
          return staleRefresh10.promise;
        }
        return freshRepo10;
      });

      const forcedRefresh = manager.requestState(10, {force: true});
      await flushPromises();

      // Concurrent same-snapshot mutation arrives while forced refresh is in flight.
      const concurrentAction = createWorkspaceState(
        10,
        'op-10-concurrent',
        'commit-10-concurrent',
      );
      expect(
        manager.setNewState(concurrentAction, {allowEqualSnapshot: true}),
      ).toBeTrue();

      staleRefresh10.resolve(createRepoState('op-10-stale', 'commit-10-stale'));
      expect(await forcedRefresh).toBeTrue();
      expect(client.getWorkspaceState).toHaveBeenCalledTimes(2);
      expect(client.getWorkspaceState.calls.argsFor(1)).toEqual([
        10,
        new OperationId('op-10-concurrent'),
      ]);
      expect(manager.getState()).toEqual({
        snapshotNumber: 10,
        repoState: freshRepo10,
      });
    });

    it('caps CAS re-fetch retries at 3 and does not poison lastSucceededVersion when aborted (CP3)', async () => {
      let attempt = 0;
      client.getWorkspaceState.and.callFake(async () => {
        attempt++;
        // Mutate state at equal snapshot 5 on every attempt to force CAS mismatch
        // on a non-forced requestState(5) (or on forced requestState(5) across 4 mismatches).
        manager.setNewState(
          createWorkspaceState(5, `op-mut-${attempt}`, `commit-mut-${attempt}`),
          {allowEqualSnapshot: true},
        );
        return createRepoState(`op-rpc-${attempt}`, `commit-rpc-${attempt}`);
      });

      // Forced refresh at snapshot 5 sees 4 consecutive CAS mismatches (1 initial + 3 retries) and aborts cleanly.
      expect(await manager.requestState(5, {force: true})).toBeFalse();
      expect(attempt).toBe(4);
      expect(manager.getState()?.repoState.opHead.hex).toBe('op-mut-4');

      // Subsequent forced refresh at snapshot 5 still executes (not poisoned).
      client.getWorkspaceState.and.resolveTo(
        createRepoState('op-final', 'commit-final'),
      );
      expect(await manager.requestState(5, {force: true})).toBeTrue();
      expect(manager.getState()?.repoState.opHead.hex).toBe('op-final');
    });

    it('makes 0 RPCs on non-forced requestState when snapshotNumber <= current state', async () => {
      manager.setNewState(createWorkspaceState(10, 'op-10', 'commit-10'));

      expect(await manager.requestState(10)).toBeFalse();
      expect(await manager.requestState(9)).toBeFalse();
      expect(await manager.requestState(9, {force: true})).toBeFalse();
      expect(client.getWorkspaceState).not.toHaveBeenCalled();
    });

    it('does not re-fetch on CAS mismatch when concurrent setNewState already satisfied or surpassed snapshotNumber', async () => {
      // Subcase 1: Non-forced requestState(10) superseded mid-flight by setNewState(10).
      const rpc10 = createDeferred<RepoState>();
      client.getWorkspaceState.and.returnValue(rpc10.promise);

      const req10 = manager.requestState(10);
      await flushPromises();
      expect(client.getWorkspaceState).toHaveBeenCalledTimes(1);

      const external10 = createWorkspaceState(10, 'op-10-ext', 'commit-10-ext');
      expect(manager.setNewState(external10)).toBeTrue();

      rpc10.resolve(createRepoState('op-10-stale', 'commit-10-stale'));
      expect(await req10).toBeFalse();
      expect(client.getWorkspaceState).toHaveBeenCalledTimes(1);
      expect(manager.getState()).toBe(external10);

      // Subcase 2: Non-forced requestState(11) and forced requestState(12) surpassed mid-flight.
      const rpc11 = createDeferred<RepoState>();
      client.getWorkspaceState.and.returnValue(rpc11.promise);

      const req11 = manager.requestState(11);
      await flushPromises();
      expect(client.getWorkspaceState).toHaveBeenCalledTimes(2);

      const external12 = createWorkspaceState(12, 'op-12-ext', 'commit-12-ext');
      expect(manager.setNewState(external12)).toBeTrue();

      rpc11.resolve(createRepoState('op-11-stale', 'commit-11-stale'));
      expect(await req11).toBeFalse();
      expect(client.getWorkspaceState).toHaveBeenCalledTimes(2);
      expect(manager.getState()).toBe(external12);

      const rpc12Forced = createDeferred<RepoState>();
      client.getWorkspaceState.and.returnValue(rpc12Forced.promise);

      const req12Forced = manager.requestState(12, {force: true});
      await flushPromises();
      expect(client.getWorkspaceState).toHaveBeenCalledTimes(3);

      const external13 = createWorkspaceState(13, 'op-13-ext', 'commit-13-ext');
      expect(manager.setNewState(external13)).toBeTrue();

      rpc12Forced.resolve(createRepoState('op-12-stale', 'commit-12-stale'));
      expect(await req12Forced).toBeFalse();
      expect(client.getWorkspaceState).toHaveBeenCalledTimes(3);
      expect(manager.getState()).toBe(external13);
    });

    it('does not re-fetch on CAS mismatch when a superseding job is already queued', async () => {
      manager.setNewState(createWorkspaceState(10, 'op-10-init', 'commit-10'));

      // Subcase 1: Forced requestState(10) yields to queued requestState(11) without re-fetching.
      const rpc10 = createDeferred<RepoState>();
      const repo11 = createRepoState('op-11-fresh', 'commit-11-fresh');
      client.getWorkspaceState.and.callFake(async (snap) => {
        if (snap === 10) {
          return rpc10.promise;
        }
        return repo11;
      });

      const forced10 = manager.requestState(10, {force: true});
      await flushPromises();
      const queued11 = manager.requestState(11);

      expect(
        manager.setNewState(
          createWorkspaceState(10, 'op-10-mut', 'commit-10-mut'),
          {allowEqualSnapshot: true},
        ),
      ).toBeTrue();

      rpc10.resolve(createRepoState('op-10-stale', 'commit-10-stale'));
      expect(await forced10).toBeFalse();
      expect(await queued11).toBeTrue();
      expect(client.getWorkspaceState).toHaveBeenCalledTimes(2);
      expect(client.getWorkspaceState.calls.argsFor(1)).toEqual([
        11,
        new OperationId('op-10-mut'),
      ]);

      // Subcase 2: Forced requestState(11) yields to a second queued forced requestState(11).
      const rpc11First = createDeferred<RepoState>();
      const repo11Second = createRepoState('op-11-second', 'commit-11-second');
      let snap11Calls = 0;
      client.getWorkspaceState.and.callFake(async () => {
        snap11Calls++;
        if (snap11Calls === 1) {
          return rpc11First.promise;
        }
        return repo11Second;
      });

      const forced11a = manager.requestState(11, {force: true});
      await flushPromises();
      const forced11b = manager.requestState(11, {force: true});

      expect(
        manager.setNewState(
          createWorkspaceState(11, 'op-11-mut', 'commit-11-mut'),
          {allowEqualSnapshot: true},
        ),
      ).toBeTrue();

      rpc11First.resolve(createRepoState('op-11-stale', 'commit-11-stale'));
      expect(await forced11a).toBeFalse();
      expect(await forced11b).toBeTrue();
      expect(snap11Calls).toBe(2);
      expect(manager.getState()).toEqual({
        snapshotNumber: 11,
        repoState: repo11Second,
      });
    });
  });
});
