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
import {ModificationType} from '../api/api';
import {SubprocessClient} from '../client/subprocess_client';
import {
  FileChangeType,
  SnapshotDelta,
} from '../file_system_watcher/file_system_watcher';
import {LocalFileSystemWatcher} from '../file_system_watcher/local_file_system_watcher';
import {removeGlobalLogger, setGlobalLogger} from '../logging/logging';
import {OutputChannelLogger} from '../logging/output_channel_logger';
import {installVscode} from '../testing/install_vscode';
import {newRepo} from '../testing/new_repo';
import {Merge} from '../utils/merge';
import {OptimisticStateEstimator} from './optimistic_state_estimator';

const activeIntervals = new Set<ReturnType<typeof setInterval>>();

function waitForDelta(
  receivedDeltas: SnapshotDelta[],
  predicate: (delta: SnapshotDelta) => boolean,
): Promise<SnapshotDelta> {
  const timeoutMs = 30000;
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const found = receivedDeltas.find(predicate);
      if (found) {
        clearInterval(interval);
        activeIntervals.delete(interval);
        resolve(found);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        activeIntervals.delete(interval);
        reject(
          new Error(
            `Timeout waiting for snapshot delta. Received ${receivedDeltas.length} deltas`,
          ),
        );
      }
    }, 100);
    activeIntervals.add(interval);
  });
}

describe('OptimisticStateEstimator with LocalFileSystemWatcher and real jj CLI', () => {
  const {jj, repo, writeFile} = newRepo();
  let watcherInstance: LocalFileSystemWatcher | null = null;

  beforeEach(() => {
    installVscode();
    const logger = new OutputChannelLogger();
    setGlobalLogger(logger);
  });

  afterEach(async () => {
    for (const interval of activeIntervals) {
      clearInterval(interval);
    }
    activeIntervals.clear();
    if (watcherInstance) {
      await watcherInstance.dispose();
      watcherInstance = null;
    }
    removeGlobalLogger();
  });

  it('estimates working copy file changes and invalidates estimation when real jj CLI updates checkout', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    const estimator = new OptimisticStateEstimator((p) => p.startsWith('.jj'));

    watcherInstance = new LocalFileSystemWatcher(repo.workspaceRoot);
    await watcherInstance._testOnlyParcelSubscription;
    const initialSnapshotNumber = watcherInstance.getCurrentSnapshotNumber();

    const deltas: SnapshotDelta[] = [];
    const addResults: Array<{delta: SnapshotDelta; accepted: boolean}> = [];
    watcherInstance.subscribe((delta) => {
      if (delta !== undefined) {
        deltas.push(delta);
        addResults.push({delta, accepted: estimator.add(delta)});
      }
    });

    writeFile('optimistic.txt', 'draft content');
    const fileDelta = await waitForDelta(deltas, (d) =>
      d.fileChanges.some(
        (c) => c.path === 'optimistic.txt' && c.type === FileChangeType.ADDED,
      ),
    );
    expect(fileDelta.stateChanged).toBeFalse();

    const estimated = estimator.getEstimatedWorkingCopy(
      initialSnapshotNumber,
      [],
    );
    expect(estimated).toBeDefined();
    expect(estimated!.files).toEqual([
      {
        path: 'optimistic.txt',
        modificationType: ModificationType.UNKNOWN,
        mergedFileMetadata: Merge.fromResolved({}),
      },
    ]);

    await jj('new', '-m', 'advance working copy');
    const checkoutDelta = await waitForDelta(
      deltas,
      (d) => d.stateChanged === true,
    );
    const recorded = addResults.find((r) => r.delta === checkoutDelta);
    expect(recorded).toBeDefined();
    expect(recorded!.accepted).toBeFalse();

    expect(
      estimator.getEstimatedWorkingCopy(checkoutDelta.snapshotNumber, []),
    ).toBeUndefined();
    const refreshedState = await client.getWorkspaceState();
    const wcCommit = refreshedState.commits.find((c) => c.active)!;
    expect(wcCommit.description.trim()).toBe('advance working copy');
  }, 30000);
});
