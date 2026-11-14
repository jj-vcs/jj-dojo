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
import {OperationId, RepoAndWorkingCopyState, RepoState} from '../api/api';
import {Client} from '../client/client';
import {createPromiseAndResolve, flushPromises} from '../testing/async';
import {fakeRepoState} from '../testing/fakes';
import {WorkspaceStateManager} from './workspace_state_manager';

function createState(
  snapshotNumber: number,
  opHeadHex = `op-${snapshotNumber}`,
): RepoAndWorkingCopyState {
  return {
    snapshotNumber,
    repoState: fakeRepoState({opHead: new OperationId(opHeadHex)}),
  };
}

describe('WorkspaceStateManager', () => {
  let client: jasmine.SpyObj<Client>;
  let manager: WorkspaceStateManager;

  beforeEach(() => {
    client = jasmine.createSpyObj<Client>('Client', ['getWorkspaceState']);
    manager = new WorkspaceStateManager(client);
  });

  it('returns undefined before initialization', () => {
    expect(manager.getState()).toBeUndefined();
  });

  describe('setNewState', () => {
    it('initializes state and updates when snapshotNumber is strictly greater', () => {
      const state1 = createState(1);
      const state2 = createState(2);

      expect(manager.setNewState(state1)).toBeTrue();
      expect(manager.getState()).toEqual(state1);

      expect(manager.setNewState(state2)).toBeTrue();
      expect(manager.getState()).toEqual(state2);
    });

    it('ignores state with an equal or older snapshotNumber', () => {
      const state2 = createState(2, 'op-initial');
      expect(manager.setNewState(state2)).toBeTrue();

      expect(manager.setNewState(createState(2, 'op-duplicate'))).toBeFalse();
      expect(manager.getState()).toEqual(state2);

      expect(manager.setNewState(createState(1, 'op-stale'))).toBeFalse();
      expect(manager.getState()).toEqual(state2);
    });
  });

  describe('waitForInitialization', () => {
    it('resolves immediately when already initialized', async () => {
      manager.setNewState(createState(1));
      await expectAsync(manager.waitForInitialization()).toBeResolved();
    });

    it('resolves all waiting callers once setNewState is called', async () => {
      let resolved1 = false;
      let resolved2 = false;
      const wait1 = manager.waitForInitialization().then(() => {
        resolved1 = true;
      });
      const wait2 = manager.waitForInitialization().then(() => {
        resolved2 = true;
      });

      await flushPromises();
      expect(resolved1).toBeFalse();
      expect(resolved2).toBeFalse();

      manager.setNewState(createState(1));
      await Promise.all([wait1, wait2]);
      expect(resolved1).toBeTrue();
      expect(resolved2).toBeTrue();
    });

    it('resolves once requestState initializes the state', async () => {
      client.getWorkspaceState.and.resolveTo(
        fakeRepoState({opHead: new OperationId('op-1')}),
      );

      let resolved = false;
      const wait = manager.waitForInitialization().then(() => {
        resolved = true;
      });

      await flushPromises();
      expect(resolved).toBeFalse();

      await manager.requestState(1);
      await wait;
      expect(resolved).toBeTrue();
    });
  });

  describe('requestState', () => {
    it('fetches state and passes lastKnownUnpublishedOperation on subsequent requests', async () => {
      const repoState1 = fakeRepoState({opHead: new OperationId('op-1')});
      const repoState2 = fakeRepoState({opHead: new OperationId('op-2')});
      client.getWorkspaceState.and.returnValues(
        Promise.resolve(repoState1),
        Promise.resolve(repoState2),
      );

      expect(await manager.requestState(1)).toBeTrue();
      expect(client.getWorkspaceState).toHaveBeenCalledWith(1, undefined);
      expect(manager.getState()).toEqual({
        snapshotNumber: 1,
        repoState: repoState1,
      });

      expect(await manager.requestState(2)).toBeTrue();
      expect(client.getWorkspaceState).toHaveBeenCalledWith(
        2,
        new OperationId('op-1'),
      );
      expect(manager.getState()).toEqual({
        snapshotNumber: 2,
        repoState: repoState2,
      });
    });

    it('executes requests sequentially and drops intermediate superseded requests', async () => {
      const req1 = createPromiseAndResolve<RepoState>();
      const req3 = createPromiseAndResolve<RepoState>();
      client.getWorkspaceState.and.callFake((snapshotNumber?: number) => {
        if (snapshotNumber === 1) {
          return req1.promise;
        }
        if (snapshotNumber === 3) {
          return req3.promise;
        }
        throw new Error(`Unexpected snapshotNumber: ${snapshotNumber}`);
      });

      const p1 = manager.requestState(1);
      await flushPromises();
      const p2 = manager.requestState(2);
      await flushPromises();
      const p3 = manager.requestState(3);
      await flushPromises();

      expect(client.getWorkspaceState).toHaveBeenCalledOnceWith(1, undefined);

      const repoState1 = fakeRepoState({opHead: new OperationId('op-1')});
      req1.resolve(repoState1);
      expect(await p1).toBeTrue();
      expect(await p2).toBeFalse();
      expect(manager.getState()).toEqual({
        snapshotNumber: 1,
        repoState: repoState1,
      });

      await flushPromises();
      expect(client.getWorkspaceState).toHaveBeenCalledTimes(2);
      expect(client.getWorkspaceState).toHaveBeenCalledWith(3, undefined);

      const repoState3 = fakeRepoState({opHead: new OperationId('op-3')});
      req3.resolve(repoState3);
      expect(await p3).toBeTrue();
      expect(manager.getState()).toEqual({
        snapshotNumber: 3,
        repoState: repoState3,
      });
    });

    it('drops requests with an older or equal snapshotNumber', async () => {
      client.getWorkspaceState.and.resolveTo(
        fakeRepoState({opHead: new OperationId('op-2')}),
      );

      expect(await manager.requestState(2)).toBeTrue();
      client.getWorkspaceState.calls.reset();

      expect(await manager.requestState(2)).toBeFalse();
      expect(await manager.requestState(1)).toBeFalse();
      expect(client.getWorkspaceState).not.toHaveBeenCalled();
    });

    it('does not overwrite newer state set via setNewState while requestState is inflight', async () => {
      const req1 = createPromiseAndResolve<RepoState>();
      client.getWorkspaceState.and.returnValue(req1.promise);

      const p1 = manager.requestState(1);
      await flushPromises();

      const newerState = createState(5, 'op-5');
      expect(manager.setNewState(newerState)).toBeTrue();

      req1.resolve(fakeRepoState({opHead: new OperationId('op-1')}));
      expect(await p1).toBeFalse();
      expect(manager.getState()).toEqual(newerState);
    });
  });
});
