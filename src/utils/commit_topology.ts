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

import {ChangeId, Commit, CommitId} from '../api/api';
import {logAndShowInternalError} from '../logging/logging';
import {HashMap} from './hashmap';

/**
 * Return the commit that is active. Throws an exception if there is no such
 * commit.
 */
export function getWorkingCopyCommit(commits: Commit[]): Commit {
  const workingCopyCommit = commits.find((commit) => commit.active);
  if (workingCopyCommit === undefined) {
    throw logAndShowInternalError('no working copy commit found');
  }
  return workingCopyCommit;
}

/**
 * Return the parent commit of the working copy commit. Returns undefined if
 * there are no or multiple parents.
 */
export function getOnlyWorkingCopyParentCommit(
  commits: Commit[],
  workingCopyCommit: Commit,
): Commit | undefined {
  if (workingCopyCommit.parents.length === 0) {
    throw logAndShowInternalError(
      `Working copy commit ${workingCopyCommit.id.hex} has no parent`,
    );
  }
  if (workingCopyCommit.parents.length !== 1) {
    return undefined;
  }
  return commits.find(
    (commit) => commit.id.hex === workingCopyCommit.parents[0].hex,
  );
}

/**
 * Returns a map from commit id to commit.
 */
export function getCommitIdToCommitMap(
  commits: Commit[],
): HashMap<CommitId, Commit> {
  const map = new HashMap<CommitId, Commit>();
  for (const commit of commits) {
    map.set(commit.id, commit);
  }
  return map;
}

/**
 * Returns a map from change id to a list of commits with that change id.
 */
export function getChangeIdToCommitsMap(
  commits: Commit[],
): HashMap<ChangeId, Commit[]> {
  const map = new HashMap<ChangeId, Commit[]>();
  for (const commit of commits) {
    const value = map.get(commit.changeId);
    if (value === undefined) {
      map.set(commit.changeId, [commit]);
    } else {
      value.push(commit);
    }
  }
  return map;
}

/**
 * Returns the evolved commit of the original commit.
 *
 * @param commits The updated list of commits.
 * @param originalCommit The original commit to be evolved.
 */
export function getEvolvedCommit(
  commits: Commit[],
  originalCommit: Commit | undefined,
): Commit | undefined {
  if (originalCommit === undefined) {
    return undefined;
  }
  if (commits.find((commit) => commit.id.hex === originalCommit?.id.hex)) {
    return originalCommit;
  }
  // Check if the changeId of originalCommit still exists at the latest
  // commit graph. If yes, update it to point to the new commit with the
  // same changeId. Otherwise, clear it to avoid showing a deleted commit.
  const evolvedCommits = commits.filter(
    (commit) => commit.changeId.hex === originalCommit?.changeId.hex,
  );
  if (evolvedCommits.length === 0) {
    // The commit no longer exists at the commit graph.
    return undefined;
  }
  if (evolvedCommits.length === 1) {
    return evolvedCommits[0];
  }
  // The commit has diverged. Ideally we want to follow the successor
  // chain to stick with the same commit. However, that would be quite
  // complicated to implement for an edge case. Just set it to undefined
  // and it would default to the working copy parent.
  return undefined;
}
