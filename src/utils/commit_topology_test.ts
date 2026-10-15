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

import {ChangeId, Commit, CommitId, MutableCommit} from '../api/api';
import {fakeCommit} from '../testing/fakes';
import {
  calculateAncestors,
  calculateDescendants,
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

    expect([...commit0.ancestors]).toEqual([commit0.id]);
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

    expect([...commit0.ancestors]).toEqual([commit0.id]);
    expect([...commit1.ancestors]).toEqual(
      jasmine.arrayWithExactContents([commit0.id, commit1.id]),
    );
    expect([...commit2.ancestors]).toEqual(
      jasmine.arrayWithExactContents([commit0.id, commit1.id, commit2.id]),
    );
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

    expect([...root.ancestors]).toEqual([root.id]);
    expect([...branchA.ancestors]).toEqual(
      jasmine.arrayWithExactContents([root.id, branchA.id]),
    );
    expect([...branchB.ancestors]).toEqual(
      jasmine.arrayWithExactContents([root.id, branchB.id]),
    );
    expect([...merge.ancestors]).toEqual(
      jasmine.arrayWithExactContents([
        root.id,
        branchA.id,
        branchB.id,
        merge.id,
      ]),
    );
  });

  it('commit with external/public base parent not in commitMap retains parent', () => {
    const externalParent = new CommitId('external-public-base');
    const commit0 = fakeCommit({
      id: new CommitId('commit0'),
      parents: [externalParent],
    });
    const commitMap = getCommitIdToCommitMap([commit0]);

    calculateAncestors(commitMap);

    expect([...commit0.ancestors]).toEqual(
      jasmine.arrayWithExactContents([commit0.id, externalParent]),
    );
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

    expect([...branchA.ancestors]).toEqual(
      jasmine.arrayWithExactContents([root.id, branchA.id]),
    );
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

    expect([...child.ancestors]).toEqual(
      jasmine.arrayWithExactContents([rootId, parentAId, child.id]),
    );
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

describe('calculateDescendants', () => {
  it('commit with no children returns itself', () => {
    const commit0 = fakeCommit({
      id: new CommitId('commit0'),
      children: [],
    });
    const commitMap = getCommitIdToCommitMap([commit0]);
    calculateDescendants(commitMap);

    expect([...commit0.descendants]).toEqual([commit0.id]);
  });

  it('linear commit chain populates all descendants including itself', () => {
    const commit2 = fakeCommit({
      id: new CommitId('commit2'),
      children: [],
    });
    const commit1 = fakeCommit({
      id: new CommitId('commit1'),
      children: [commit2.id],
    });
    const commit0 = fakeCommit({
      id: new CommitId('commit0'),
      children: [commit1.id],
    });
    // Pass parents before children to verify child descendants are computed first
    const commits = [commit0, commit1, commit2];
    const commitMap = getCommitIdToCommitMap(commits);

    calculateDescendants(commitMap);

    expect([...commit2.descendants]).toEqual([commit2.id]);
    expect([...commit1.descendants]).toEqual(
      jasmine.arrayWithExactContents([commit1.id, commit2.id]),
    );
    expect([...commit0.descendants]).toEqual(
      jasmine.arrayWithExactContents([commit0.id, commit1.id, commit2.id]),
    );
  });

  it('diamond commit graph returns union of descendants without duplicates', () => {
    // root -> branchA -> merge
    // root -> branchB -> merge
    const merge = fakeCommit({
      id: new CommitId('merge'),
      children: [],
    });
    const branchA = fakeCommit({
      id: new CommitId('branchA'),
      children: [merge.id],
    });
    const branchB = fakeCommit({
      id: new CommitId('branchB'),
      children: [merge.id],
    });
    const root = fakeCommit({
      id: new CommitId('root'),
      children: [branchA.id, branchB.id],
    });
    const commits = [root, branchA, branchB, merge];
    const commitMap = getCommitIdToCommitMap(commits);

    calculateDescendants(commitMap);

    expect([...merge.descendants]).toEqual([merge.id]);
    expect([...branchA.descendants]).toEqual(
      jasmine.arrayWithExactContents([branchA.id, merge.id]),
    );
    expect([...branchB.descendants]).toEqual(
      jasmine.arrayWithExactContents([branchB.id, merge.id]),
    );
    expect([...root.descendants]).toEqual(
      jasmine.arrayWithExactContents([
        root.id,
        branchA.id,
        branchB.id,
        merge.id,
      ]),
    );
  });

  it('commit with child not in commitMap retains child', () => {
    const externalChild = new CommitId('external-child');
    const commit0 = fakeCommit({
      id: new CommitId('commit0'),
      children: [externalChild],
    });
    const commitMap = getCommitIdToCommitMap([commit0]);

    calculateDescendants(commitMap);

    expect([...commit0.descendants]).toEqual(
      jasmine.arrayWithExactContents([commit0.id, externalChild]),
    );
  });

  it('does not include ancestors or commits on separate branches', () => {
    const childA = fakeCommit({
      id: new CommitId('childA'),
      children: [],
    });
    const branchA = fakeCommit({
      id: new CommitId('branchA'),
      children: [childA.id],
    });
    const branchB = fakeCommit({
      id: new CommitId('branchB'),
      children: [],
    });
    const root = fakeCommit({
      id: new CommitId('root'),
      children: [branchA.id, branchB.id],
    });
    const commits = [root, branchA, branchB, childA];
    const commitMap = getCommitIdToCommitMap(commits);

    calculateDescendants(commitMap);

    expect([...branchA.descendants]).toEqual(
      jasmine.arrayWithExactContents([branchA.id, childA.id]),
    );
  });

  it('reuses already calculated descendants from child commits (dynamic programming)', () => {
    const grandchildId = new CommitId('grandchild');
    const childAId = new CommitId('childA');
    const childA = fakeCommit({
      id: childAId,
      children: [grandchildId],
      descendants: new HashSet<CommitId>([grandchildId, childAId]),
    });
    const parent = fakeCommit({
      id: new CommitId('parent'),
      children: [childAId],
    });
    // grandchild is intentionally not in the commit map to prove childA's descendants were reused
    const commitMap = getCommitIdToCommitMap([parent, childA]);

    calculateDescendants(commitMap);

    expect([...parent.descendants]).toEqual(
      jasmine.arrayWithExactContents([parent.id, childAId, grandchildId]),
    );
  });

  it('handles deep commit histories iteratively without stack overflow', () => {
    const count = 2000;
    const commits: MutableCommit[] = [];
    for (let i = 0; i < count; i++) {
      commits.push(
        fakeCommit({
          id: new CommitId(`commit-${i}`),
          children: i < count - 1 ? [new CommitId(`commit-${i + 1}`)] : [],
        }),
      );
    }
    const commitMap = getCommitIdToCommitMap(commits);
    calculateDescendants(commitMap);

    const firstCommit = commits[0];
    expect(firstCommit.descendants.size()).toBe(count);
    expect(firstCommit.descendants.has(new CommitId('commit-0'))).toBeTrue();
    expect(
      firstCommit.descendants.has(new CommitId(`commit-${count - 1}`)),
    ).toBeTrue();
  });
});
