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
import {
  SearchBoxStateManager,
  getSearchBoxManager,
  TEST_ONLY,
} from './search_box_state';

describe('SearchBoxStateManager', () => {
  let manager: SearchBoxStateManager;

  beforeEach(() => {
    manager = new SearchBoxStateManager();
  });

  it('initial state is closed', () => {
    expect(manager.isSearchBoxOpen()).toBeFalse();
  });

  it('notifies subscribers when search box is opened and closed', () => {
    const receivedStates: boolean[] = [];
    const callback = (isOpen: boolean) => {
      receivedStates.push(isOpen);
    };

    manager.subscribe(callback);
    expect(receivedStates).toEqual([]);

    manager.setSearchBoxOpen(true);
    expect(manager.isSearchBoxOpen()).toBeTrue();
    expect(receivedStates).toEqual([true]);

    manager.setSearchBoxOpen(false);
    expect(manager.isSearchBoxOpen()).toBeFalse();
    expect(receivedStates).toEqual([true, false]);
  });

  it('does not re-notify when setting the same state', () => {
    let callCount = 0;
    manager.subscribe(() => {
      callCount++;
    });

    manager.setSearchBoxOpen(true);
    expect(callCount).toBe(1);

    // Setting true again should be a no-op
    manager.setSearchBoxOpen(true);
    expect(callCount).toBe(1);

    manager.setSearchBoxOpen(false);
    expect(callCount).toBe(2);

    // Setting false again should be a no-op
    manager.setSearchBoxOpen(false);
    expect(callCount).toBe(2);
  });

  it('unsubscribes correctly', () => {
    let callCount = 0;
    const callback = () => {
      callCount++;
    };

    manager.subscribe(callback);
    manager.setSearchBoxOpen(true);
    expect(callCount).toBe(1);

    manager.unsubscribe(callback);
    manager.setSearchBoxOpen(false);
    expect(callCount).toBe(1);
  });

  it('throws error when subscribing already subscribed callback', () => {
    const callback = () => {};
    manager.subscribe(callback);
    expect(() => {
      manager.subscribe(callback);
    }).toThrowError('Callback is already subscribed.');
  });

  it('throws error when unsubscribing a callback that is not subscribed', () => {
    const callback = () => {};
    expect(() => {
      manager.unsubscribe(callback);
    }).toThrowError('Callback was not subscribed.');
  });

  it('singleton manager works and can be reset for testing', () => {
    const globalManager = getSearchBoxManager();
    expect(globalManager.isSearchBoxOpen()).toBeFalse();

    globalManager.setSearchBoxOpen(true);
    expect(globalManager.isSearchBoxOpen()).toBeTrue();

    TEST_ONLY.resetSearchBoxStateForTesting();
    expect(getSearchBoxManager().isSearchBoxOpen()).toBeFalse();
  });
});
