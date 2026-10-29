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
import {CommitFile, FileType, ModificationType} from '../api/api';
import {FileChangeType} from '../file_system_watcher/file_system_watcher';
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
          modificationType: ModificationType.REMOVED,
          mergedFileMetadata: Merge.fromResolved(undefined),
        },
        {
          path: 'bar.txt',
          modificationType: ModificationType.UNKNOWN,
          mergedFileMetadata: Merge.fromResolved({fileType: FileType.FILE}),
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
          mergedFileMetadata: Merge.fromResolved({fileType: FileType.FILE}),
        },
        {
          path: 'baz.txt',
          modificationType: ModificationType.REMOVED,
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
        fileType: FileType.FILE,
        psha2Sum: 'foo',
      }),
    };
    expect(estimator.getEstimatedWorkingCopy(10, [foo])).toBeUndefined();
  });

  it('discards buffered deltas when clear() is called', () => {
    const estimator = createSampleEstimator();
    estimator.clear();
    expect(estimator.getEstimatedWorkingCopy(10, [])).toBeUndefined();
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
});
