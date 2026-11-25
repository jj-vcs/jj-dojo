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

import {SequentialExecutor} from './sequential_executor';

/** Yields to the macrotask queue so pending promise continuations can run. */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Returns a `promise` that will resolve once `resolve` is called.
 */
function createPromiseAndResolve() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolveInner) => {
    resolve = resolveInner;
  });
  return {promise, resolve};
}

describe('SequentialExecutor', () => {
  it('executes a single job', async () => {
    const executor = new SequentialExecutor();
    const result = await executor.execute({
      version: 1,
      fn: async () => 1,
    });
    expect(result).toBe(1);
  });

  it('executes jobs sequentially', async () => {
    const executor = new SequentialExecutor();
    const {promise, resolve} = createPromiseAndResolve();

    let fn1Executed = false;
    let fn2Executed = false;
    const fn1 = async () => {
      await promise;
      fn1Executed = true;
      return 1;
    };
    const fn2 = async () => {
      fn2Executed = true;
      return 2;
    };

    const result1 = executor.execute({
      version: 1,
      fn: fn1,
    });
    await flushPromises();
    const result2 = executor.execute({
      version: 2,
      fn: fn2,
    });
    await flushPromises();

    expect(fn1Executed).toBeFalse();
    expect(fn2Executed).toBeFalse();

    resolve();
    await flushPromises();
    expect(await result1).toBe(1);
    expect(await result2).toBe(2);
    expect(fn1Executed).toBeTrue();
    expect(fn2Executed).toBeTrue();
  });

  it('drops queued jobs superseded by a higher version', async () => {
    const executor = new SequentialExecutor();
    const {promise, resolve} = createPromiseAndResolve();

    let fn1Executed = false;
    let fn2Executed = false;
    let fn3Executed = false;
    const fn1 = async () => {
      await promise;
      fn1Executed = true;
      return 1;
    };
    const fn2 = async () => {
      fn2Executed = true;
      return 2;
    };
    const fn3 = async () => {
      fn3Executed = true;
      return 3;
    };

    const result1 = executor.execute({
      version: 1,
      fn: fn1,
    });
    await flushPromises();
    const result2 = executor.execute({
      version: 2,
      fn: fn2,
    });
    await flushPromises();
    const result3 = executor.execute({
      version: 3,
      fn: fn3,
    });
    await flushPromises();

    resolve();
    await flushPromises();
    expect(await result1).toBe(1);
    expect(await result2).toBeUndefined();
    expect(await result3).toBe(3);
    expect(fn1Executed).toBeTrue();
    expect(fn2Executed).toBeFalse();
    expect(fn3Executed).toBeTrue();
  });

  it('drops jobs enqueued with an older or equal version', async () => {
    const executor = new SequentialExecutor();
    expect(
      await executor.execute({
        version: 2,
        fn: async () => 'v2',
      }),
    ).toBe('v2');

    let staleExecuted = false;
    expect(
      await executor.execute({
        version: 2,
        fn: async () => {
          staleExecuted = true;
          return 'duplicate-v2';
        },
      }),
    ).toBeUndefined();
    expect(
      await executor.execute({
        version: 1,
        fn: async () => {
          staleExecuted = true;
          return 'stale-v1';
        },
      }),
    ).toBeUndefined();
    expect(staleExecuted).toBeFalse();
  });

  it('continues executing subsequent jobs after an inflight job fails', async () => {
    const executor = new SequentialExecutor();
    const {promise, resolve} = createPromiseAndResolve();

    const result1 = executor.execute({
      version: 1,
      fn: async () => {
        await promise;
        throw new Error('job 1 failed');
      },
    });
    await flushPromises();

    const result2 = executor.execute({
      version: 2,
      fn: async () => 2,
    });
    await flushPromises();

    resolve();
    await expectAsync(result1).toBeRejectedWithError('job 1 failed');
    expect(await result2).toBe(2);
  });

  it('allows same-version retry after a failed or uncommitted job (didCommit === false)', async () => {
    const executor = new SequentialExecutor();

    await expectAsync(
      executor.execute({
        version: 5,
        fn: async () => {
          throw new Error('transient error');
        },
      }),
    ).toBeRejectedWithError('transient error');

    // Same version 5 should not be poisoned after rejection.
    const uncommitted = await executor.execute({
      version: 5,
      didCommit: (res) => res.committed,
      fn: async () => ({committed: false, tag: 'cas-aborted'}),
    });
    expect(uncommitted).toEqual({committed: false, tag: 'cas-aborted'});

    // Same version 5 should still execute because didCommit returned false.
    const committed = await executor.execute({
      version: 5,
      didCommit: (res) => res.committed,
      fn: async () => ({committed: true, tag: 'applied'}),
    });
    expect(committed).toEqual({committed: true, tag: 'applied'});

    // Now that version 5 committed, a non-forced version 5 is dropped.
    expect(
      await executor.execute({
        version: 5,
        fn: async () => ({committed: true, tag: 'duplicate'}),
      }),
    ).toBeUndefined();
  });

  it('executes force: true jobs at lastSucceededVersion while dropping strictly older versions', async () => {
    const executor = new SequentialExecutor();
    expect(
      await executor.execute({
        version: 10,
        fn: async () => 'initial-10',
      }),
    ).toBe('initial-10');

    expect(
      await executor.execute({
        version: 10,
        force: true,
        fn: async () => 'forced-10-a',
      }),
    ).toBe('forced-10-a');

    expect(
      await executor.execute({
        version: 10,
        force: true,
        fn: async () => 'forced-10-b',
      }),
    ).toBe('forced-10-b');

    let olderRan = false;
    expect(
      await executor.execute({
        version: 9,
        force: true,
        fn: async () => {
          olderRan = true;
          return 'stale-9';
        },
      }),
    ).toBeUndefined();
    expect(olderRan).toBeFalse();
  });

  it('coalesces non-forced same-version job behind uncommitted inflight job: drops on success and retries on failure', async () => {
    const executor = new SequentialExecutor();

    // Subcase 1: In-flight version 4 fails -> queued non-forced version 4 retries.
    const gateFail = createPromiseAndResolve();
    const firstAttempt = executor.execute({
      version: 4,
      fn: async () => {
        await gateFail.promise;
        throw new Error('socket closed');
      },
    });
    await flushPromises();

    let retryCount = 0;
    const coalescedRetry = executor.execute({
      version: 4,
      fn: async () => {
        retryCount++;
        return 'recovered-v4';
      },
    });

    gateFail.resolve();
    await expectAsync(firstAttempt).toBeRejectedWithError('socket closed');
    expect(await coalescedRetry).toBe('recovered-v4');
    expect(retryCount).toBe(1);

    // Subcase 2: In-flight version 7 succeeds -> queued non-forced version 7 drops with 0 extra calls.
    const gateOk = createPromiseAndResolve();
    const inflightOk = executor.execute({
      version: 7,
      fn: async () => {
        await gateOk.promise;
        return 'committed-v7';
      },
    });
    await flushPromises();

    let duplicateCalls = 0;
    const coalescedDuplicate = executor.execute({
      version: 7,
      fn: async () => {
        duplicateCalls++;
        return 'extra-v7';
      },
    });

    gateOk.resolve();
    expect(await inflightOk).toBe('committed-v7');
    expect(await coalescedDuplicate).toBeUndefined();
    expect(duplicateCalls).toBe(0);
  });

  it('reports hasSupersedingQueuedJob accurately and resolves waitForIdle once drained', async () => {
    const executor = new SequentialExecutor();
    const gate = createPromiseAndResolve();

    let sawSupersedingFromNonForced = true;
    let sawSupersedingFromForced = false;

    const first = executor.execute({
      version: 3,
      force: true,
      fn: async () => {
        await gate.promise;
        sawSupersedingFromForced = executor.hasSupersedingQueuedJob(3, true);
        return 'first';
      },
    });
    await flushPromises();

    // Enqueue a non-forced v3: does NOT supersede an active forced v3,
    // though it would supersede a non-forced v3.
    const nonForcedQueued = executor.execute({
      version: 3,
      force: false,
      fn: async () => 'non-forced',
    });
    expect(executor.hasSupersedingQueuedJob(3, true)).toBeFalse();
    expect(executor.hasSupersedingQueuedJob(3, false)).toBeTrue();

    // Enqueue a forced v3: supersedes active forced v3 and drops nonForcedQueued.
    const forcedQueued = executor.execute({
      version: 3,
      force: true,
      fn: async () => {
        sawSupersedingFromNonForced = executor.hasSupersedingQueuedJob(3, true);
        return 'second-forced';
      },
    });
    expect(await nonForcedQueued).toBeUndefined();
    expect(executor.hasSupersedingQueuedJob(3, true)).toBeTrue();

    let idleResolved = false;
    const idle = executor.waitForIdle().then(() => {
      idleResolved = true;
    });
    await flushPromises();
    expect(idleResolved).toBeFalse();

    gate.resolve();
    expect(await first).toBe('first');
    expect(await forcedQueued).toBe('second-forced');
    await idle;
    expect(idleResolved).toBeTrue();
    expect(sawSupersedingFromForced).toBeTrue();
    expect(sawSupersedingFromNonForced).toBeFalse();
  });

  it('drops stale forced jobs against inflightVersion and queued.version without evicting newer queued jobs', async () => {
    const executor = new SequentialExecutor();
    const gate = createPromiseAndResolve();

    const inflightV5 = executor.execute({
      version: 5,
      fn: async () => {
        await gate.promise;
        return 'v5';
      },
    });
    await flushPromises();

    // lastSucceededVersion is still undefined; inflightVersion === 5 must drop forced v4.
    let staleV4Ran = false;
    expect(
      await executor.execute({
        version: 4,
        force: true,
        fn: async () => {
          staleV4Ran = true;
          return 'stale-v4';
        },
      }),
    ).toBeUndefined();
    expect(staleV4Ran).toBeFalse();

    // Queue v8 behind in-flight v5.
    const queuedV8 = executor.execute({
      version: 8,
      fn: async () => 'v8',
    });
    expect(executor.hasSupersedingQueuedJob(3, true)).toBeTrue();
    expect(executor.hasSupersedingQueuedJob(9, false)).toBeFalse();

    // Forced v6 is < queued.version (8): must drop immediately without evicting v8.
    let staleV6Ran = false;
    expect(
      await executor.execute({
        version: 6,
        force: true,
        fn: async () => {
          staleV6Ran = true;
          return 'stale-v6';
        },
      }),
    ).toBeUndefined();
    expect(staleV6Ran).toBeFalse();

    gate.resolve();
    expect(await inflightV5).toBe('v5');
    expect(await queuedV8).toBe('v8');
  });

  it('clears inflightVersion and updates lastSucceededVersion before caller continuations resume', async () => {
    const executor = new SequentialExecutor();

    // When v5 rejects, inflightVersion must already be cleared when .catch() runs.
    const fallbackResult = await executor
      .execute({
        version: 5,
        fn: async () => {
          throw new Error('v5 failed');
        },
      })
      .catch(() =>
        executor.execute({
          version: 4,
          fn: async () => 'fallback-v4',
        }),
      );
    expect(fallbackResult).toBe('fallback-v4');

    // When v6 resolves, lastSucceededVersion must already be 6 when .then() runs.
    const duplicateResult = await executor
      .execute({
        version: 6,
        fn: async () => 'committed-v6',
      })
      .then(() =>
        executor.execute({
          version: 6,
          fn: async () => 'duplicate-v6',
        }),
      );
    expect(duplicateResult).toBeUndefined();
  });
});
