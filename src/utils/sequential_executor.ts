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

/**
 * A class that executes versioned jobs sequentially. The first job is always
 * executed as soon as it is enqueued. Any subsequent jobs must have a higher
 * version number than previously enqueued jobs for them to be executed. If
 * multiple jobs are enqueued while there is an inflight job, only the job with
 * the highest version will be executed, and the rest are dropped.
 */
export class SequentialExecutor {
  /** The result of the job that is currently being executed. */
  private inflight?: Promise<unknown>;

  /** The highest version number among all jobs enqueued so far. */
  private nextVersion?: number;

  /**
   * Executes the given job if its version is higher than all previously
   * enqueued jobs.
   *
   * @return The result of the job, or `undefined` if the job was dropped.
   */
  async execute<T>(job: {
    version: number;
    fn: () => Promise<T>;
  }): Promise<T | undefined> {
    if (this.nextVersion !== undefined && this.nextVersion >= job.version) {
      // A job with the same or a higher version has already been enqueued.
      return undefined;
    }
    this.nextVersion = job.version;

    try {
      // Wait for the inflight job to finish.
      await this.inflight;
    } catch {
      // Ignore any errors from the inflight job.
    }

    if (this.nextVersion !== job.version) {
      // A newer job with a higher version was enqueued while waiting for the
      // inflight job to finish, so drop this job.
      return undefined;
    }
    const result = job.fn();
    this.inflight = result;
    return result;
  }
}
