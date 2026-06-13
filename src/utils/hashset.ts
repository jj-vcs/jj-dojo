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

import {HashMap, HashMapKey} from './hashmap';

/**
 * This is a set that uses the `toString()` value of `HashMapKey` to determine
 * equality.
 *
 * See `HashMap` for more details.
 */
export class HashSet<Key extends HashMapKey> implements Iterable<Key> {
  private readonly map = new HashMap<Key, void>();

  constructor(iterable?: Iterable<Key>) {
    if (iterable !== undefined) {
      for (const key of iterable) {
        this.add(key);
      }
    }
  }

  /** Returns an iterator for the ImmutableSet. */
  [Symbol.iterator](): Iterator<Key> {
    return this.map.keys();
  }

  keys(): IterableIterator<Key> {
    return this.map.keys();
  }

  add(key: Key) {
    this.map.set(key);
  }

  has(key: Key): boolean {
    return this.map.has(key);
  }

  delete(key: Key): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size();
  }
}
