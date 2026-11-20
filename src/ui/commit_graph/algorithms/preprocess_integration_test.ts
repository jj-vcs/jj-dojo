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
import {Commit as ApiCommit} from '../../../api/api';
import {SubprocessClient} from '../../../client/subprocess_client';
import {newRepo} from '../../../testing/new_repo';
import {Commit} from '../api/types';
import {createCommitNodes} from './preprocess';

function apiCommitsToGraphCommits(apiCommits: readonly ApiCommit[]): Commit[] {
  return apiCommits.map((c) => ({
    hash: c.id.hex,
    childrenHashes: c.childIds.map((ch) => ch.hex),
    isEmpty: c.files.length === 0,
    shortDescription: c.descriptionTitle,
    fullDescription: c.description,
    active: c.active,
    isImmutable: c.isImmutable,
    hasConflict: c.hasConflict,
    hasDiverged: c.hasDiverged,
    chips: [],
    displayId: c.displayId,
    highlightedDisplayIdLen: c.highlightedDisplayIdLen,
    updateTime: c.updateTime,
    isMultiSelected: false,
  }));
}

describe('createCommitNodes with real jj CLI', () => {
  const {jj, repo, getWcChangeId} = newRepo();

  it('builds valid coordinates and tileGroups for a redundant parent-child merge commit from real jj repo', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);

    await jj('describe', '-m', 'commit A');
    const aChangeId = await getWcChangeId();

    await jj('new', aChangeId, '-m', 'commit B');
    const bChangeId = await getWcChangeId();

    // Create commit C with redundant edge to both A and B (A -> B -> C and A -> C)
    await jj('new', aChangeId, bChangeId, '-m', 'commit C');

    const state = await client.getWorkspaceState();
    const graphCommits = apiCommitsToGraphCommits(state.commits);
    const nodesMap = createCommitNodes(graphCommits);

    expect(nodesMap.size).toBe(4);
    const rootCommit = state.commits.find((c) => c.parentIds.length === 0)!;
    const commitA = state.commits.find(
      (c) => c.description.trim() === 'commit A',
    )!;
    const commitB = state.commits.find(
      (c) => c.description.trim() === 'commit B',
    )!;
    const commitC = state.commits.find(
      (c) => c.description.trim() === 'commit C',
    )!;

    const nodeRoot = nodesMap.get(rootCommit.id.hex)!;
    const nodeA = nodesMap.get(commitA.id.hex)!;
    const nodeB = nodesMap.get(commitB.id.hex)!;
    const nodeC = nodesMap.get(commitC.id.hex)!;

    // Coordinates: C stays in column 0 while B branches out to column 1
    expect([nodeRoot.x, nodeRoot.y]).toEqual([0, 0]);
    expect([nodeA.x, nodeA.y]).toEqual([0, 1]);
    expect([nodeB.x, nodeB.y]).toEqual([1, 2]);
    expect([nodeC.x, nodeC.y]).toEqual([0, 3]);

    // Tile group widths reflect the extra branch lane across A and B
    expect(nodeRoot.tileGroups.length).toBe(1);
    expect(nodeA.tileGroups.length).toBe(2);
    expect(nodeB.tileGroups.length).toBe(2);
    expect(nodeC.tileGroups.length).toBe(1);

    // Ancestors of active working copy C have isWorkingCopyCommitAncestor = true
    expect(nodeRoot.isWorkingCopyCommitAncestor).toBeTrue();
    expect(nodeA.isWorkingCopyCommitAncestor).toBeTrue();
    expect(nodeB.isWorkingCopyCommitAncestor).toBeTrue();
    expect(nodeC.isWorkingCopyCommitAncestor).toBeTrue();
  });
});
