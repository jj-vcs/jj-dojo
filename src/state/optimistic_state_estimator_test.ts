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
import {CommitFile, FileId, ModificationType} from '../api/api';
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

function createSampleEstimator(): OptimisticStateEstimator {
  const estimator = new OptimisticStateEstimator();
  estimator.add({
    snapshotNumber: 11,
    fileChanges: [{path: 'foo.txt', type: FileChangeType.DELETED}],
    stateChanged: false,
  });
  estimator.add({
    snapshotNumber: 12,
    fileChanges: [{path: 'bar.txt', type: FileChangeType.MODIFIED}],
    stateChanged: false,
  });
  estimator.add({
    snapshotNumber: 14,
    fileChanges: [{path: 'baz.txt', type: FileChangeType.DELETED}],
    stateChanged: false,
  });
  return estimator;
}

describe('OptimisticStateEstimator', () => {
  it('does not give estimates for non-consecutive snapshots', () => {
    const estimator = createSampleEstimator();
    expect(estimator.getEstimatedWorkingCopy(9, [])).toBeUndefined();
  });

  it('gives estimates for consecutive snapshots and stops at a gap', () => {
    const estimator = createSampleEstimator();
    expect(estimator.getEstimatedWorkingCopy(10, [])).toEqual({
      snapshotNumber: 12,
      files: [
        {
          path: 'foo.txt',
          modificationType: ModificationType.DELETED,
          mergedFileMetadata: Merge.fromResolved(undefined),
        },
        {
          path: 'bar.txt',
          modificationType: ModificationType.UNKNOWN,
          mergedFileMetadata: Merge.fromResolved({}),
        },
      ],
    });
  });

  it('evicts deltas <= lastKnownSnapshotNumber on partial refresh', () => {
    const estimator = new OptimisticStateEstimator();
    estimator.add({
      snapshotNumber: 11,
      fileChanges: [{path: 'foo.txt', type: FileChangeType.DELETED}],
      stateChanged: false,
    });
    estimator.add({
      snapshotNumber: 12,
      fileChanges: [{path: 'bar.txt', type: FileChangeType.MODIFIED}],
      stateChanged: false,
    });
    estimator.add({
      snapshotNumber: 13,
      fileChanges: [{path: 'baz.txt', type: FileChangeType.DELETED}],
      stateChanged: false,
    });

    expect(estimator.getEstimatedWorkingCopy(11, [])).toEqual({
      snapshotNumber: 13,
      files: [
        {
          path: 'bar.txt',
          modificationType: ModificationType.UNKNOWN,
          mergedFileMetadata: Merge.fromResolved({}),
        },
        {
          path: 'baz.txt',
          modificationType: ModificationType.DELETED,
          mergedFileMetadata: Merge.fromResolved(undefined),
        },
      ],
    });
  });

  it('does not give estimates when stateChanged is true', () => {
    const estimator = new OptimisticStateEstimator();
    expect(
      estimator.add({
        snapshotNumber: 11,
        fileChanges: [{path: 'foo.txt', type: FileChangeType.MODIFIED}],
        stateChanged: true,
      }),
    ).toBeFalse();
    estimator.add({
      snapshotNumber: 12,
      fileChanges: [{path: 'bar.txt', type: FileChangeType.MODIFIED}],
      stateChanged: false,
    });

    const foo: CommitFile = {
      path: 'foo.txt',
      modificationType: ModificationType.ADDED,
      mergedFileMetadata: Merge.fromResolved({
        fileId: new FileId('foo'),
      }),
    };
    expect(estimator.getEstimatedWorkingCopy(10, [foo])).toBeUndefined();
  });

  it('throws when snapshotNumber is not strictly increasing', () => {
    const estimator = new OptimisticStateEstimator();
    estimator.add({
      snapshotNumber: 11,
      fileChanges: [],
      stateChanged: false,
    });
    expect(() =>
      estimator.add({
        snapshotNumber: 11,
        fileChanges: [],
        stateChanged: false,
      }),
    ).toThrowError(
      'Snapshot deltas are not in strictly increasing order: 11 >= 11',
    );
    expect(() =>
      estimator.add({
        snapshotNumber: 10,
        fileChanges: [],
        stateChanged: false,
      }),
    ).toThrowError(
      'Snapshot deltas are not in strictly increasing order: 11 >= 10',
    );
  });

  it('does not give estimates for conflicted files', () => {
    const estimator = new OptimisticStateEstimator();
    estimator.add({
      snapshotNumber: 11,
      fileChanges: [
        {path: 'foo.txt', type: FileChangeType.MODIFIED},
        {path: 'bar.txt', type: FileChangeType.MODIFIED},
      ],
      stateChanged: false,
    });
    const foo: CommitFile = {
      path: 'foo.txt',
      modificationType: ModificationType.CONFLICTED,
      mergedFileMetadata: Merge.fromAlternatingAddsAndRemoves([
        {fileId: new FileId('foo1')},
        {fileId: new FileId('foo2')},
        {fileId: new FileId('foo3')},
      ]),
    };
    const bar: CommitFile = {
      path: 'bar.txt',
      modificationType: ModificationType.UNKNOWN,
      mergedFileMetadata: Merge.fromResolved({
        fileId: new FileId('bar'),
      }),
    };
    expect(estimator.getEstimatedWorkingCopy(10, [foo, bar])).toEqual({
      snapshotNumber: 11,
      files: [
        foo,
        {
          path: 'bar.txt',
          modificationType: ModificationType.UNKNOWN,
          mergedFileMetadata: Merge.fromResolved({}),
        },
      ],
    });
  });

  it('keeps the original modification type and source on modify and transitions to DELETED on delete', () => {
    const estimator = new OptimisticStateEstimator();
    estimator.add({
      snapshotNumber: 11,
      fileChanges: [
        {path: 'foo.txt', type: FileChangeType.MODIFIED},
        {path: 'bar.txt', type: FileChangeType.DELETED},
        {path: 'renamed.txt', type: FileChangeType.MODIFIED},
      ],
      stateChanged: false,
    });
    const foo: CommitFile = {
      path: 'foo.txt',
      modificationType: ModificationType.ADDED,
      mergedFileMetadata: Merge.fromResolved({
        fileId: new FileId('foo'),
      }),
    };
    const bar: CommitFile = {
      path: 'bar.txt',
      modificationType: ModificationType.MODIFIED,
      mergedFileMetadata: Merge.fromResolved({
        fileId: new FileId('bar'),
      }),
    };
    const renamed: CommitFile = {
      path: 'renamed.txt',
      modificationType: ModificationType.RENAMED,
      mergedFileMetadata: Merge.fromResolved({
        fileId: new FileId('renamed'),
      }),
      source: 'old_name.txt',
    };
    expect(estimator.getEstimatedWorkingCopy(10, [foo, bar, renamed])).toEqual({
      snapshotNumber: 11,
      files: [
        {
          path: 'foo.txt',
          modificationType: ModificationType.ADDED,
          mergedFileMetadata: Merge.fromResolved({}),
        },
        {
          path: 'bar.txt',
          modificationType: ModificationType.DELETED,
          mergedFileMetadata: Merge.fromResolved(undefined),
        },
        {
          path: 'renamed.txt',
          modificationType: ModificationType.RENAMED,
          mergedFileMetadata: Merge.fromResolved({}),
          source: 'old_name.txt',
        },
      ],
    });
  });

  it('transitions DELETED to UNKNOWN when added back', () => {
    const estimator = new OptimisticStateEstimator();
    estimator.add({
      snapshotNumber: 11,
      fileChanges: [{path: 'foo.txt', type: FileChangeType.ADDED}],
      stateChanged: false,
    });
    const foo: CommitFile = {
      path: 'foo.txt',
      modificationType: ModificationType.DELETED,
      mergedFileMetadata: Merge.fromResolved(undefined),
    };
    expect(estimator.getEstimatedWorkingCopy(10, [foo])).toEqual({
      snapshotNumber: 11,
      files: [
        {
          path: 'foo.txt',
          modificationType: ModificationType.UNKNOWN,
          mergedFileMetadata: Merge.fromResolved({}),
        },
      ],
    });
  });

  it('skips untracked ignored files while advancing snapshotNumber and updating tracked files', () => {
    const estimator = new OptimisticStateEstimator(
      (path) => path.endsWith('.swp') || path.startsWith('.'),
    );
    estimator.add({
      snapshotNumber: 11,
      fileChanges: [{path: 'foo.txt.swp', type: FileChangeType.ADDED}],
      stateChanged: false,
    });
    estimator.add({
      snapshotNumber: 12,
      fileChanges: [
        {path: '.gitignore', type: FileChangeType.MODIFIED},
        {path: 'bar.txt.swp', type: FileChangeType.MODIFIED},
        {path: 'bar.txt', type: FileChangeType.ADDED},
      ],
      stateChanged: false,
    });

    const trackedDotfile: CommitFile = {
      path: '.gitignore',
      modificationType: ModificationType.MODIFIED,
      mergedFileMetadata: Merge.fromResolved({
        fileId: new FileId('old'),
      }),
    };

    expect(estimator.getEstimatedWorkingCopy(10, [trackedDotfile])).toEqual({
      snapshotNumber: 12,
      files: [
        {
          path: '.gitignore',
          modificationType: ModificationType.MODIFIED,
          mergedFileMetadata: Merge.fromResolved({}),
        },
        {
          path: 'bar.txt',
          modificationType: ModificationType.UNKNOWN,
          mergedFileMetadata: Merge.fromResolved({}),
        },
      ],
    });
  });
});

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
        resolve(found);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(
          new Error(
            `Timeout waiting for snapshot delta. Received ${receivedDeltas.length} deltas`,
          ),
        );
      }
    }, 100);
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

    const estimated = estimator.getEstimatedWorkingCopy(0, []);
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
  });
});
