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
});
