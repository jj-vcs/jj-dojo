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

import {Commit, CommitId} from '../../api/api';
import {logAndShowInternalError} from '../../logging/logging';
import {HashMap} from '../../utils/hashmap';

/**
 * VSCode extensions including jj commonly use the QuickPick dialog to allow
 * users to select a commit from a list. @CommitOrderManager manages how the
 * list of commits should be ordered when displayed to the user.
 *
 * The commit graph calls setOrder() to set the new order of the commits
 * according to how they are listed in the commit graph. Then the QuickPick
 * dialog calls sortCommits() to sort the to-be-displayed commits according to
 * the new order.
 */
export class CommitOrderManager {
  /**
   * A map from commit id to the order of the commit in the list.
   * A smaller number means the commit should be displayed earlier in the list.
   */
  private readonly order = new HashMap<CommitId, number>();

  /**
   * Sets the display order of commits by rotating `topToBottomOrder` so that
   * the working copy commit comes first, followed by commits below it in the
   * graph, and then commits above it. Throws an error if `wcCommitIndex` is out
   * of bounds.
   *
   * @param topToBottomOrder The commit IDs ordered from top to bottom as
   *   displayed in the commit graph.
   * @param wcCommitIndex The index of the working copy commit in
   *   `topToBottomOrder`.
   */
  setOrder(topToBottomOrder: readonly CommitId[], wcCommitIndex: number) {
    if (wcCommitIndex < 0 || wcCommitIndex >= topToBottomOrder.length) {
      throw logAndShowInternalError(
        `wcCommitIndex (${wcCommitIndex}) is out of bounds for topToBottomOrder of length ${topToBottomOrder.length}`,
      );
    }
    this.order.clear();
    let index = 0;
    for (let i = wcCommitIndex; i < topToBottomOrder.length; i++) {
      this.order.set(topToBottomOrder[i], index++);
    }
    for (let i = 0; i < wcCommitIndex; i++) {
      this.order.set(topToBottomOrder[i], index++);
    }
  }

  /** Sorts the commits in place based on the order set by setOrder(). */
  sortCommits(commits: Commit[]) {
    commits.sort((commit1, commit2) => {
      const order1 = this.order.get(commit1.id);
      const order2 = this.order.get(commit2.id);
      if (order1 === undefined && order2 === undefined) {
        // This should happen very rarely, only when user happens to select a
        // commit during the very short period where a new list of commits is
        // known to the extension, but not yet updated in the commit graph.
        // In this case, just place the unknown commits at the end of the list.
        // If both commits are unknown, just use a deterministic order.
        if (commit1.updateTime !== commit2.updateTime) {
          return commit1.updateTime - commit2.updateTime;
        }
        return commit1.displayId.localeCompare(commit2.displayId);
      }
      if (order1 === undefined) {
        // Return the known commit (commit2) first.
        return 1;
      }
      if (order2 === undefined) {
        // Return the known commit (commit1) first.
        return -1;
      }
      return order1 - order2;
    });
  }
}
