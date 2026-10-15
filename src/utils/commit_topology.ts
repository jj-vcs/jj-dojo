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

import {ChangeId, Commit, CommitId, MutableCommit} from '../api/api';
import {logAndShowInternalError} from '../logging/logging';
import {HashMap, ReadonlyHashMap} from './hashmap';

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
  if (workingCopyCommit.parentIds.length === 0) {
    throw logAndShowInternalError(
      `Working copy commit ${workingCopyCommit.id.hex} has no parent`,
    );
  }
  if (workingCopyCommit.parentIds.length !== 1) {
    return undefined;
  }
  return commits.find(
    (commit) => commit.id.hex === workingCopyCommit.parentIds[0].hex,
  );
}

/**
 * Returns a map from commit id to commit.
 */
export function getCommitIdToCommitMap<T extends Commit = Commit>(
  commits: readonly T[],
): HashMap<CommitId, T> {
  const map = new HashMap<CommitId, T>();
  for (const commit of commits) {
    map.set(commit.id, commit);
  }
  return map;
}

/**
 * Calculates and populates the `ancestors` field for all commits in `commitMap`.
 *
 * The algorithm uses an iterative post-order DFS to prevent call stack overflow
 * on deep commit histories and leverages dynamic programming by computing parent
 * ancestors before child ancestors regardless of map iteration order.
 *
 * @param commitMap A map from commit ID to mutable commit.
 */
export function calculateAncestors(
  commitMap: ReadonlyHashMap<CommitId, MutableCommit>,
): void {
  for (const commit of commitMap.values()) {
    const stack: MutableCommit[] = [commit];
    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      if (current.ancestors.size() > 0) {
        stack.pop();
        continue;
      }
      // Ensure parent elements are always explored first.
      let pushedParents = false;
      for (const parentId of current.parentIds) {
        const parent = commitMap.get(parentId);
        // Commits with no ancestors are not yet explored.
        if (parent && parent.ancestors.size() === 0) {
          stack.push(parent);
          pushedParents = true;
        }
      }
      if (pushedParents) {
        continue;
      }
      stack.pop();
      current.ancestors.add(current.id);
      for (const parentId of current.parentIds) {
        const parent = commitMap.get(parentId);
        if (parent) {
          for (const parentAncestor of parent.ancestors) {
            current.ancestors.add(parentAncestor);
          }
        } else {
          current.ancestors.add(parentId);
        }
      }
    }
  }
}

/**
 * Calculates and populates the `descendants` field for all commits in
 * `commitMap`.
 *
 * The algorithm uses an iterative post-order DFS to prevent call stack overflow
 * on deep commit histories and leverages dynamic programming by computing child
 * descendants before parent descendants regardless of map iteration order.
 *
 * @param commitMap A map from commit ID to mutable commit.
 */
export function calculateDescendants(
  commitMap: ReadonlyHashMap<CommitId, MutableCommit>,
): void {
  for (const commit of commitMap.values()) {
    const stack: MutableCommit[] = [commit];
    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      if (current.descendants.size() > 0) {
        stack.pop();
        continue;
      }
      // Ensure child elements are always explored first.
      let pushedChildren = false;
      for (const childId of current.childIds) {
        const child = commitMap.get(childId);
        // Commits with no descendants are not yet explored.
        if (child && child.descendants.size() === 0) {
          stack.push(child);
          pushedChildren = true;
        }
      }
      if (pushedChildren) {
        continue;
      }
      stack.pop();
      current.descendants.add(current.id);
      for (const childId of current.childIds) {
        const child = commitMap.get(childId);
        if (child) {
          for (const childDescendant of child.descendants) {
            current.descendants.add(childDescendant);
          }
        } else {
          current.descendants.add(childId);
        }
      }
    }
  }
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
