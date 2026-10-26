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
  CommitFile,
  FileMetadata,
  FileType,
  ModificationType,
  OperationId,
  RepoState,
} from '../api';
import {FileChangeType} from '../../file_system_watcher/file_system_watcher';
import {fakeCommit} from '../../testing/fakes';
import {Merge} from '../../utils/merge';
import {FileIgnoreMatcher} from './file_ignore_matcher';
import {OptimisticStateEstimator} from './optimistic_state_estimator';

const NO_OP_FILE_IGNORE_MATCHER: FileIgnoreMatcher = {
  isIgnored: () => false,
};

function newRepoState(options: Partial<RepoState> = {}): RepoState {
  return {
    opHead: new OperationId(''),
    commits: [],
    ...options,
  };
}

function newFileMetadata(options: Partial<FileMetadata> = {}): FileMetadata {
  return {
    fileType: FileType.FILE,
    psha2Sum: undefined,
    ...options,
  };
}

function testSuite1(): OptimisticStateEstimator {
  const estimator = new OptimisticStateEstimator(NO_OP_FILE_IGNORE_MATCHER);
  estimator.add({
    snapshotNumber: 11,
    fileChanges: [
      {
        path: 'google3/foo.txt',
        type: FileChangeType.DELETED,
      },
    ],
    stateChanged: false,
  });
  estimator.add({
    snapshotNumber: 12,
    fileChanges: [
      {
        path: 'google3/bar.txt',
        type: FileChangeType.MODIFIED,
      },
    ],
    stateChanged: false,
  });
  estimator.add({
    snapshotNumber: 14,
    fileChanges: [
      {
        path: 'google3/baz.txt',
        type: FileChangeType.DELETED,
      },
    ],
    stateChanged: false,
  });
  return estimator;
}

describe('OptimisticStateEstimator', () => {
  it('does not give estimates for non-consecutive snapshots', () => {
    const estimator = testSuite1();
    const repoState = newRepoState({
      commits: [
        fakeCommit({
          active: true,
          files: [],
        }),
      ],
    });
    expect(
      estimator.getEstimatedState({
        snapshotNumber: 9,
        repoState,
      }),
    ).toEqual({
      snapshotNumber: 9,
      repoState,
    });
  });

  it('give estimates for consecutive snapshots', () => {
    const estimator = testSuite1();
    const repoState = newRepoState({
      commits: [
        fakeCommit({
          active: true,
          files: [],
        }),
      ],
    });
    const state = estimator.getEstimatedState({
      snapshotNumber: 10,
      repoState,
    });
    expect(state.snapshotNumber).toEqual(12);
    expect(state.repoState.commits[0].files).toEqual([
      {
        path: 'google3/foo.txt',
        modificationType: ModificationType.REMOVED,
        mergedFileMetadata: Merge.fromResolved(undefined),
      },
      {
        path: 'google3/bar.txt',
        modificationType: ModificationType.UNKNOWN,
        mergedFileMetadata: Merge.fromResolved({
          fileType: FileType.FILE,
          psha2Sum: undefined,
        }),
      },
    ]);
  });

  it('gives estimates correctly even if there are known snapshots', () => {
    const estimator = testSuite1();
    const repoState = newRepoState({
      commits: [
        fakeCommit({
          active: true,
          files: [],
        }),
      ],
    });
    const state = estimator.getEstimatedState({
      snapshotNumber: 13,
      repoState,
    });
    expect(state.snapshotNumber).toEqual(14);
    expect(state.repoState.commits[0].files).toEqual([
      {
        path: 'google3/baz.txt',
        modificationType: ModificationType.REMOVED,
        mergedFileMetadata: Merge.fromResolved(undefined),
      },
    ]);
  });

  it('does not give estimates for conflicted files', () => {
    const estimator = new OptimisticStateEstimator(NO_OP_FILE_IGNORE_MATCHER);
    estimator.add({
      snapshotNumber: 11,
      fileChanges: [
        {
          path: 'google3/foo.txt',
          type: FileChangeType.MODIFIED,
        },
        {
          path: 'google3/bar.txt',
          type: FileChangeType.MODIFIED,
        },
      ],
      stateChanged: false,
    });
    const foo: CommitFile = {
      path: 'google3/foo.txt',
      modificationType: ModificationType.MERGED,
      mergedFileMetadata: Merge.fromAlternatingAddsAndRemoves([
        newFileMetadata({
          fileType: FileType.FILE,
          psha2Sum: 'foo1',
        }),
        newFileMetadata({
          fileType: FileType.FILE,
          psha2Sum: 'foo2',
        }),
        newFileMetadata({
          fileType: FileType.FILE,
          psha2Sum: 'foo3',
        }),
      ]),
    };
    const bar: CommitFile = {
      path: 'google3/bar.txt',
      modificationType: ModificationType.UNKNOWN,
      mergedFileMetadata: Merge.fromResolved({
        fileType: FileType.FILE,
        psha2Sum: 'bar',
      }),
    };
    const repoState = newRepoState({
      commits: [
        fakeCommit({
          active: true,
          files: [foo, bar],
        }),
      ],
    });
    const state = estimator.getEstimatedState({
      snapshotNumber: 10,
      repoState,
    });
    expect(state.snapshotNumber).toEqual(11);
    expect(state.repoState.commits[0].files).toEqual([
      foo,
      {
        path: 'google3/bar.txt',
        modificationType: ModificationType.UNKNOWN,
        mergedFileMetadata: Merge.fromResolved({
          fileType: FileType.FILE,
          psha2Sum: undefined,
        }),
      },
    ]);
  });

  it('keeps the original modification type', () => {
    const estimator = new OptimisticStateEstimator(NO_OP_FILE_IGNORE_MATCHER);
    estimator.add({
      snapshotNumber: 11,
      fileChanges: [
        {
          path: 'google3/foo.txt',
          type: FileChangeType.MODIFIED,
        },
      ],
      stateChanged: false,
    });
    const foo: CommitFile = {
      path: 'google3/foo.txt',
      modificationType: ModificationType.ADDED,
      mergedFileMetadata: Merge.fromResolved({
        fileType: FileType.FILE,
        psha2Sum: 'foo',
      }),
    };
    const state = estimator.getEstimatedState({
      snapshotNumber: 10,
      repoState: newRepoState({
        commits: [
          fakeCommit({
            active: true,
            files: [foo],
          }),
        ],
      }),
    });
    expect(state.snapshotNumber).toEqual(11);
    expect(state.repoState.commits[0].files).toEqual([
      {
        path: 'google3/foo.txt',
        modificationType: ModificationType.ADDED, // Keeps ADDED and does not change it to MODIFIED.
        mergedFileMetadata: Merge.fromResolved({
          fileType: FileType.FILE,
          psha2Sum: undefined,
        }),
      },
    ]);
  });

  it('removed and added back has modification type UNKNOWN', () => {
    const estimator = new OptimisticStateEstimator(NO_OP_FILE_IGNORE_MATCHER);
    estimator.add({
      snapshotNumber: 11,
      fileChanges: [
        {
          path: 'google3/foo.txt',
          type: FileChangeType.ADDED,
        },
      ],
      stateChanged: false,
    });
    const foo: CommitFile = {
      path: 'google3/foo.txt',
      modificationType: ModificationType.REMOVED,
      mergedFileMetadata: Merge.fromResolved(undefined),
    };
    const state = estimator.getEstimatedState({
      snapshotNumber: 10,
      repoState: newRepoState({
        commits: [
          fakeCommit({
            active: true,
            files: [foo],
          }),
        ],
      }),
    });
    expect(state.snapshotNumber).toEqual(11);
    expect(state.repoState.commits[0].files).toEqual([
      {
        path: 'google3/foo.txt',
        modificationType: ModificationType.UNKNOWN,
        mergedFileMetadata: Merge.fromResolved({
          fileType: FileType.FILE,
          psha2Sum: undefined,
        }),
      },
    ]);
  });

  it('does not give estimates when stateChanged is true', () => {
    const estimator = new OptimisticStateEstimator(NO_OP_FILE_IGNORE_MATCHER);
    estimator.add({
      snapshotNumber: 11,
      fileChanges: [
        {
          path: 'google3/foo.txt',
          type: FileChangeType.MODIFIED,
        },
      ],
      stateChanged: true,
    });
    const foo: CommitFile = {
      path: 'google3/foo.txt',
      modificationType: ModificationType.ADDED,
      mergedFileMetadata: Merge.fromResolved({
        fileType: FileType.FILE,
        psha2Sum: 'foo',
      }),
    };
    const state = estimator.getEstimatedState({
      snapshotNumber: 10,
      repoState: newRepoState({
        commits: [
          fakeCommit({
            active: true,
            files: [foo],
          }),
        ],
      }),
    });
    expect(state.snapshotNumber).toEqual(10);
    expect(state.repoState.commits[0].files).toEqual([foo]);
  });
});
