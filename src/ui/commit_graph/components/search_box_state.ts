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

/** A callback that is called when the search box open state changes. */
export type SearchBoxSubscriberCallback = (isOpen: boolean) => void;

/**
 * A class that stores the current open state of the search box and notifies
 * subscribers when it changes.
 */
export class SearchBoxStateManager {
  private isOpen = false;
  private readonly subscribers = new Set<SearchBoxSubscriberCallback>();

  isSearchBoxOpen(): boolean {
    return this.isOpen;
  }

  setSearchBoxOpen(isOpen: boolean) {
    if (this.isOpen === isOpen) {
      return;
    }
    this.isOpen = isOpen;
    this.informSubscribers();
  }

  private informSubscribers() {
    for (const callback of this.subscribers) {
      callback(this.isOpen);
    }
  }

  subscribe(callback: SearchBoxSubscriberCallback) {
    if (this.subscribers.has(callback)) {
      throw new Error('Callback is already subscribed.');
    }
    this.subscribers.add(callback);
  }

  unsubscribe(callback: SearchBoxSubscriberCallback) {
    if (!this.subscribers.delete(callback)) {
      throw new Error('Callback was not subscribed.');
    }
  }
}

let globalSearchBoxStateManager = new SearchBoxStateManager();

/**
 * Returns the global search box state manager.
 */
export function getSearchBoxManager(): SearchBoxStateManager {
  return globalSearchBoxStateManager;
}

export const TEST_ONLY = {
  resetSearchBoxStateForTesting: () => {
    globalSearchBoxStateManager = new SearchBoxStateManager();
  },
};
