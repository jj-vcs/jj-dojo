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

import {Commit} from '../api/types';

/**
 * Returns the commits that are focused in the commit graph.
 *
 * A commit is focused if any of the following is true:
 *  - It is the working copy commit, or
 *  - It is an ancestor of the working copy commit.
 *  - It is a descendant of the working copy commit.
 */
export function getFocusedCommits(commits: Commit[]): Commit[] {
  if (commits.length === 0) {
    return [];
  }

  const wcCommit = commits.find((commit) => commit.active);
  if (wcCommit === undefined) {
    throw new Error('No working copy commit found.');
  }

  const commitsMap = new Map<string, Commit>();
  for (const commit of commits) {
    commitsMap.set(commit.hash, commit);
  }

  const parentsMap = new Map<string, Commit[]>();
  for (const commit of commits) {
    for (const childHash of commit.childrenHashes) {
      const child = commitsMap.get(childHash);
      if (child === undefined) {
        throw new Error(`Child commit ${childHash} not found.`);
      }
      const parents = parentsMap.get(childHash);
      if (parents === undefined) {
        parentsMap.set(childHash, [commit]);
      } else {
        parents.push(commit);
      }
    }
  }

  const isFocused = getReachableCommits(wcCommit, commitsMap, parentsMap);

  // Filter out commits that are not focused.
  // Also filter out child hashes that are not focused.
  const focusedCommits: Commit[] = [];
  for (const commit of commits) {
    if (!isFocused.has(commit.hash)) {
      continue;
    }
    focusedCommits.push({
      ...commit,
      childrenHashes: commit.childrenHashes.filter((childHash) =>
        isFocused.has(childHash),
      ),
    });
  }
  return focusedCommits;
}

/**
 * Given a commit, return all commits that are reachable from it in the domain
 * of mutable commits.
 */
function getReachableCommits(
  initialCommit: Commit,
  commitsMap: Map<string, Commit>,
  parentsMap: Map<string, Commit[]>,
): Set<string> {
  const isFocused = new Set<string>();

  const queue: Commit[] = [];

  const addToQueue = (commit: Commit) => {
    if (isFocused.has(commit.hash)) {
      // This commit has been processed already.
      return;
    }
    isFocused.add(commit.hash);

    if (!commit.isImmutable) {
      queue.push(commit);
    }
  };

  addToQueue(initialCommit);
  while (queue.length > 0) {
    const commit = queue.pop()!;
    for (const parent of parentsMap.get(commit.hash) || []) {
      addToQueue(parent);
    }
    for (const childHash of commit.childrenHashes) {
      const child = commitsMap.get(childHash);
      if (child === undefined) {
        throw new Error(`Child commit ${childHash} not found.`);
      }
      addToQueue(child);
    }
  }
  return isFocused;
}
