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

interface QueuedJobOutcome {
  readonly committed: boolean;
  readonly settleCaller: () => void;
}

interface QueuedJob {
  readonly version: number;
  readonly force: boolean;
  readonly drop: () => void;
  readonly run: () => Promise<QueuedJobOutcome>;
}

/**
 * Executes versioned async jobs sequentially, coalescing intermediate jobs so
 * at most one job is in flight and at most one superseding job is queued.
 *
 * By default (`force: false`), a job only executes if its version is strictly
 * greater than `lastSucceededVersion` (the highest version whose execution
 * resolved with `didCommit(result) === true`). When `force: true` is set, a job
 * with `version === lastSucceededVersion` is also allowed to execute, while
 * jobs strictly older than any committed, in-flight, or queued version are
 * dropped.
 */
export class SequentialExecutor {
  /** Highest version whose `fn` resolved and satisfied `didCommit`. */
  private lastSucceededVersion?: number;

  /** Version of the job currently executing in `drain()`, if any. */
  private inflightVersion?: number;

  /** Single pending job waiting for the current in-flight job to settle. */
  private queued?: QueuedJob;

  /** Whether `drain()` is currently running. */
  private draining = false;

  /** Resolves when the executor has no in-flight or queued jobs. */
  private idlePromise: Promise<void> = Promise.resolve();

  /**
   * Executes `job.fn` sequentially according to its `version` and `force`
   * policy.
   *
   * @returns The result of `job.fn()`, or `undefined` if the job was dropped or
   *   superseded before running.
   */
  execute<T>(job: {
    version: number;
    force?: boolean;
    didCommit?: (result: T) => boolean;
    fn: () => Promise<T>;
  }): Promise<T | undefined> {
    const force = job.force ?? false;
    const maxKnown = maxDefined(
      this.lastSucceededVersion,
      this.inflightVersion,
      this.queued?.version,
    );

    if (maxKnown !== undefined && job.version < maxKnown) {
      return Promise.resolve(undefined);
    }

    if (!force) {
      if (
        this.lastSucceededVersion !== undefined &&
        job.version <= this.lastSucceededVersion
      ) {
        return Promise.resolve(undefined);
      }
      if (this.queued !== undefined && job.version <= this.queued.version) {
        return Promise.resolve(undefined);
      }
    }

    return new Promise<T | undefined>((resolve, reject) => {
      if (this.queued !== undefined) {
        this.queued.drop();
      }

      this.queued = {
        version: job.version,
        force,
        drop: () => {
          resolve(undefined);
        },
        run: async (): Promise<QueuedJobOutcome> => {
          try {
            const result = await job.fn();
            const committed = job.didCommit ? job.didCommit(result) : true;
            return {
              committed,
              settleCaller: () => {
                resolve(result);
              },
            };
          } catch (err: unknown) {
            return {
              committed: false,
              settleCaller: () => {
                reject(err);
              },
            };
          }
        },
      };

      if (!this.draining) {
        this.draining = true;
        this.idlePromise = this.drain();
      }
    });
  }

  /**
   * Returns true if a queued job already supersedes a currently executing job
   * at `(version, force)`.
   */
  hasSupersedingQueuedJob(version: number, force: boolean): boolean {
    if (this.queued === undefined) {
      return false;
    }
    if (this.queued.version > version) {
      return true;
    }
    if (this.queued.version === version) {
      return this.queued.force || !force;
    }
    return false;
  }

  /**
   * Resolves once any currently in-flight and queued jobs have settled.
   */
  waitForIdle(): Promise<void> {
    return this.idlePromise;
  }

  private async drain(): Promise<void> {
    try {
      while (this.queued !== undefined) {
        const current = this.queued;
        this.queued = undefined;

        if (
          this.lastSucceededVersion !== undefined &&
          (current.force
            ? current.version < this.lastSucceededVersion
            : current.version <= this.lastSucceededVersion)
        ) {
          current.drop();
          continue;
        }

        this.inflightVersion = current.version;
        const outcome = await current.run();
        this.inflightVersion = undefined;

        if (
          outcome.committed &&
          (this.lastSucceededVersion === undefined ||
            current.version > this.lastSucceededVersion)
        ) {
          this.lastSucceededVersion = current.version;
        }
        outcome.settleCaller();
      }
    } finally {
      this.inflightVersion = undefined;
      this.draining = false;
    }
  }
}

function maxDefined(
  a: number | undefined,
  b: number | undefined,
  c: number | undefined,
): number | undefined {
  let result = a;
  if (b !== undefined && (result === undefined || b > result)) {
    result = b;
  }
  if (c !== undefined && (result === undefined || c > result)) {
    result = c;
  }
  return result;
}
