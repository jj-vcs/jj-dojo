/**
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

import {ChangeId, Commit, CommitId} from '../api/api';
import {newCommit} from '../testing/fakes';
import {
  getEvolvedCommit,
  getOnlyWorkingCopyParentCommit,
  getWorkingCopyCommit,
} from './commit_topology';

describe('getOnlyWorkingCopyParentCommit', () => {
  const getWcParent = (commits: Commit[]) =>
    getOnlyWorkingCopyParentCommit(commits, getWorkingCopyCommit(commits));

  it('working copy parent not found', () => {
    const commits: Commit[] = [
      newCommit({
        id: new CommitId('commit0'),
        parents: [new CommitId('commit1')],
      }),
    ];
    expect(() => getWcParent(commits)).toThrow();
  });

  it('one working copy parent', () => {
    const commits: Commit[] = [
      newCommit({
        id: new CommitId('commit0'),
        parents: [new CommitId('commit1')],
        active: true,
      }),
      newCommit({
        id: new CommitId('commit1'),
      }),
    ];
    expect(getWcParent(commits)).toEqual(commits[1]);
  });

  it('multiple working copy parents', () => {
    const commits: Commit[] = [
      newCommit({
        id: new CommitId('commit0'),
        parents: [new CommitId('commit1'), new CommitId('commit2')],
        active: true,
      }),
      newCommit({
        id: new CommitId('commit1'),
      }),
      newCommit({
        id: new CommitId('commit2'),
      }),
    ];
    expect(getWcParent(commits)).toBeUndefined();
  });
});

describe('getEvolvedCommit', () => {
  it('commit never changed', () => {
    const commits: Commit[] = [
      newCommit({
        id: new CommitId('1'),
      }),
    ];
    expect(getEvolvedCommit(commits, commits[0])).toEqual(commits[0]);
  });

  it('commit changed', () => {
    const originalCommit = newCommit({
      id: new CommitId('commit0-original'),
      changeId: new ChangeId('changeId0'),
    });
    const commits: Commit[] = [
      newCommit({
        id: new CommitId('commit0-evolved'),
        changeId: new ChangeId('changeId0'),
      }),
      newCommit({
        id: new CommitId('commit1'),
        changeId: new ChangeId('changeId1'),
      }),
    ];
    expect(getEvolvedCommit(commits, originalCommit)).toEqual(commits[0]);
  });
});
