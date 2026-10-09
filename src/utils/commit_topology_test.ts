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

import {ChangeId, Commit, CommitId, MutableCommit} from '../api/api';
import {fakeCommit} from '../testing/fakes';
import {
  calculateAncestors,
  getCommitIdToCommitMap,
  getEvolvedCommit,
  getOnlyWorkingCopyParentCommit,
  getWorkingCopyCommit,
} from './commit_topology';
import {HashSet} from './hashset';

describe('getOnlyWorkingCopyParentCommit', () => {
  const getWcParent = (commits: Commit[]) =>
    getOnlyWorkingCopyParentCommit(commits, getWorkingCopyCommit(commits));

  it('working copy parent not found', () => {
    const commits: Commit[] = [
      fakeCommit({
        id: new CommitId('commit0'),
        parents: [new CommitId('commit1')],
      }),
    ];
    expect(() => getWcParent(commits)).toThrow();
  });

  it('one working copy parent', () => {
    const commits: Commit[] = [
      fakeCommit({
        id: new CommitId('commit0'),
        parents: [new CommitId('commit1')],
        active: true,
      }),
      fakeCommit({
        id: new CommitId('commit1'),
      }),
    ];
    expect(getWcParent(commits)).toEqual(commits[1]);
  });

  it('multiple working copy parents', () => {
    const commits: Commit[] = [
      fakeCommit({
        id: new CommitId('commit0'),
        parents: [new CommitId('commit1'), new CommitId('commit2')],
        active: true,
      }),
      fakeCommit({
        id: new CommitId('commit1'),
      }),
      fakeCommit({
        id: new CommitId('commit2'),
      }),
    ];
    expect(getWcParent(commits)).toBeUndefined();
  });
});

describe('getEvolvedCommit', () => {
  it('commit never changed', () => {
    const commits: Commit[] = [
      fakeCommit({
        id: new CommitId('1'),
      }),
    ];
    expect(getEvolvedCommit(commits, commits[0])).toEqual(commits[0]);
  });

  it('commit changed', () => {
    const originalCommit = fakeCommit({
      id: new CommitId('commit0-original'),
      changeId: new ChangeId('changeId0'),
    });
    const commits: Commit[] = [
      fakeCommit({
        id: new CommitId('commit0-evolved'),
        changeId: new ChangeId('changeId0'),
      }),
      fakeCommit({
        id: new CommitId('commit1'),
        changeId: new ChangeId('changeId1'),
      }),
    ];
    expect(getEvolvedCommit(commits, originalCommit)).toEqual(commits[0]);
  });
});

describe('calculateAncestors', () => {
  it('commit with no parents returns itself', () => {
    const commit0 = fakeCommit({
      id: new CommitId('commit0'),
      parents: [],
    });
    const commitMap = getCommitIdToCommitMap([commit0]);
    calculateAncestors(commitMap);

    expect(commit0.ancestors.size()).toBe(1);
    expect(commit0.ancestors.has(commit0.id)).toBeTrue();
  });

  it('linear commit chain populates all ancestors including itself', () => {
    const commit0 = fakeCommit({
      id: new CommitId('commit0'),
      parents: [],
    });
    const commit1 = fakeCommit({
      id: new CommitId('commit1'),
      parents: [commit0.id],
    });
    const commit2 = fakeCommit({
      id: new CommitId('commit2'),
      parents: [commit1.id],
    });
    // Pass in reverse topological order (children before parents, matching jj log)
    const commits = [commit2, commit1, commit0];
    const commitMap = getCommitIdToCommitMap(commits);

    calculateAncestors(commitMap);

    expect(commit0.ancestors.size()).toBe(1);
    expect(commit0.ancestors.has(commit0.id)).toBeTrue();

    expect(commit1.ancestors.size()).toBe(2);
    expect(commit1.ancestors.has(commit0.id)).toBeTrue();
    expect(commit1.ancestors.has(commit1.id)).toBeTrue();

    expect(commit2.ancestors.size()).toBe(3);
    expect(commit2.ancestors.has(commit0.id)).toBeTrue();
    expect(commit2.ancestors.has(commit1.id)).toBeTrue();
    expect(commit2.ancestors.has(commit2.id)).toBeTrue();
  });

  it('diamond commit graph returns union of ancestors without duplicates', () => {
    // root -> branchA -> merge
    // root -> branchB -> merge
    const root = fakeCommit({
      id: new CommitId('root'),
      parents: [],
    });
    const branchA = fakeCommit({
      id: new CommitId('branchA'),
      parents: [root.id],
    });
    const branchB = fakeCommit({
      id: new CommitId('branchB'),
      parents: [root.id],
    });
    const merge = fakeCommit({
      id: new CommitId('merge'),
      parents: [branchA.id, branchB.id],
    });
    const commits = [merge, branchA, branchB, root];
    const commitMap = getCommitIdToCommitMap(commits);

    calculateAncestors(commitMap);

    expect(merge.ancestors.size()).toBe(4);
    expect(merge.ancestors.has(merge.id)).toBeTrue();
    expect(merge.ancestors.has(branchA.id)).toBeTrue();
    expect(merge.ancestors.has(branchB.id)).toBeTrue();
    expect(merge.ancestors.has(root.id)).toBeTrue();
  });

  it('commit with external/public base parent not in commitMap retains parent', () => {
    const externalParent = new CommitId('external-public-base');
    const commit0 = fakeCommit({
      id: new CommitId('commit0'),
      parents: [externalParent],
    });
    const commitMap = getCommitIdToCommitMap([commit0]);

    calculateAncestors(commitMap);

    expect(commit0.ancestors.size()).toBe(2);
    expect(commit0.ancestors.has(commit0.id)).toBeTrue();
    expect(commit0.ancestors.has(externalParent)).toBeTrue();
  });

  it('does not include descendants or commits on separate branches', () => {
    const root = fakeCommit({
      id: new CommitId('root'),
      parents: [],
    });
    const branchA = fakeCommit({
      id: new CommitId('branchA'),
      parents: [root.id],
    });
    const branchB = fakeCommit({
      id: new CommitId('branchB'),
      parents: [root.id],
    });
    const childA = fakeCommit({
      id: new CommitId('childA'),
      parents: [branchA.id],
    });
    const commits = [childA, branchA, branchB, root];
    const commitMap = getCommitIdToCommitMap(commits);

    calculateAncestors(commitMap);

    expect(branchA.ancestors.size()).toBe(2);
    expect(branchA.ancestors.has(branchA.id)).toBeTrue();
    expect(branchA.ancestors.has(root.id)).toBeTrue();
    expect(branchA.ancestors.has(branchB.id)).toBeFalse();
    expect(branchA.ancestors.has(childA.id)).toBeFalse();
  });

  it('reuses already calculated ancestors from parent commits (dynamic programming)', () => {
    const rootId = new CommitId('root');
    const parentAId = new CommitId('parentA');
    const parentA = fakeCommit({
      id: parentAId,
      parents: [rootId],
      ancestors: new HashSet<CommitId>([rootId, parentAId]),
    });
    const child = fakeCommit({
      id: new CommitId('child'),
      parents: [parentAId],
    });
    // root is intentionally not in the commit map to prove parentA's ancestors were reused
    const commitMap = getCommitIdToCommitMap([child, parentA]);

    calculateAncestors(commitMap);

    expect(child.ancestors.size()).toBe(3);
    expect(child.ancestors.has(child.id)).toBeTrue();
    expect(child.ancestors.has(parentAId)).toBeTrue();
    expect(child.ancestors.has(rootId)).toBeTrue();
  });

  it('handles deep commit histories iteratively without stack overflow', () => {
    const count = 2000;
    const commits: MutableCommit[] = [];
    for (let i = count - 1; i >= 0; i--) {
      commits.push(
        fakeCommit({
          id: new CommitId(`commit-${i}`),
          parents: i > 0 ? [new CommitId(`commit-${i - 1}`)] : [],
        }),
      );
    }
    const commitMap = getCommitIdToCommitMap(commits);
    calculateAncestors(commitMap);

    const lastCommit = commits[0];
    expect(lastCommit.ancestors.size()).toBe(count);
    expect(lastCommit.ancestors.has(new CommitId('commit-0'))).toBeTrue();
    expect(
      lastCommit.ancestors.has(new CommitId(`commit-${count - 1}`)),
    ).toBeTrue();
  });
});
