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
import {getFocusedCommits} from './focus_mode';

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

describe('getFocusedCommits with real jj CLI', () => {
  const {jj, repo, getWcChangeId} = newRepo();

  it('includes working copy ancestors/descendants and excludes unrelated mutable branches in real jj repo', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);

    await jj('describe', '-m', 'unrelated branch');
    await jj('new', 'root()', '-m', 'focused parent');
    const focusedParentChangeId = await getWcChangeId();

    await jj('new', focusedParentChangeId, '-m', 'focused working copy');
    const focusedWcChangeId = await getWcChangeId();

    await jj('new', focusedWcChangeId, '-m', 'focused descendant');
    await jj('edit', focusedWcChangeId);

    const state = await client.getWorkspaceState();
    const graphCommits = apiCommitsToGraphCommits(state.commits);

    const focused = getFocusedCommits(graphCommits);
    const focusedDescriptions = focused.map((c) => c.shortDescription);

    expect(focusedDescriptions).toContain('');
    expect(focusedDescriptions).toContain('focused parent');
    expect(focusedDescriptions).toContain('focused working copy');
    expect(focusedDescriptions).toContain('focused descendant');
    expect(focusedDescriptions).not.toContain('unrelated branch');
  });
});
