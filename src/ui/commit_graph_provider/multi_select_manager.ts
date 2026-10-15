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

import {HashMapKey} from '../../utils/hashmap';
import {ReadonlyHashSet, HashSet} from '../../utils/hashset';

/**
 * Manages the multi-selection state of the commit graph.
 */
export class MultiSelectManager<CommitId extends HashMapKey> {
  readonly multiSelected = new HashSet<CommitId>();

  private topToBottomOrder?: readonly CommitId[];

  /**
   * Tracks the last clicked commit, so we can select ranges of commits when
   * shift-clicking.
   */
  private lastClicked?: CommitId;

  setOrder(order: readonly CommitId[]) {
    this.topToBottomOrder = order;
  }

  onClick(commitId: CommitId, metaKey: boolean, shiftKey: boolean) {
    if (shiftKey && this.lastClicked && this.topToBottomOrder) {
      const lastClickedKey = this.lastClicked.toString();
      const commitKey = commitId.toString();
      const firstClick = this.topToBottomOrder.findIndex(
        (id) => id.toString() === lastClickedKey,
      );
      const secondClick = this.topToBottomOrder.findIndex(
        (id) => id.toString() === commitKey,
      );
      if (firstClick !== -1 && secondClick !== -1) {
        const startIndex = Math.min(firstClick, secondClick);
        const endIndex = Math.max(firstClick, secondClick);
        for (let i = startIndex; i <= endIndex; ++i) {
          this.multiSelected.add(this.topToBottomOrder[i]);
        }
        return;
      }
      // Otherwise, fall through and ignore the shift key.
    }

    this.lastClicked = commitId;
    if (metaKey) {
      // If cmd or ctrl is pressed, toggle the state.
      this.toggle(commitId);
    } else {
      // Otherwise, set the selection to just this commit.
      this.set([commitId]);
    }
  }

  /**
   * Evicts any commits that are no longer in the repo state.
   */
  evictMissing(commitIds: ReadonlyHashSet<CommitId>) {
    for (const commitId of this.multiSelected) {
      if (!commitIds.has(commitId)) {
        this.multiSelected.delete(commitId);
      }
    }
    if (this.lastClicked && !commitIds.has(this.lastClicked)) {
      this.lastClicked = undefined;
    }
  }

  /**
   * Returns the only selected commit, or undefined if there is not exactly one
   * selected commit.
   */
  getOnlySelected(): CommitId | undefined {
    if (this.multiSelected.size() === 1) {
      return this.multiSelected.keys().next().value;
    }
    return undefined;
  }

  private toggle(commitId: CommitId) {
    if (this.multiSelected.has(commitId)) {
      this.multiSelected.delete(commitId);
    } else {
      this.multiSelected.add(commitId);
    }
  }

  private set(commitIds: readonly CommitId[]) {
    this.multiSelected.clear();
    for (const commitId of commitIds) {
      this.multiSelected.add(commitId);
    }
  }
}
