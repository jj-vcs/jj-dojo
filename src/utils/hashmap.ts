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

/**
 * A hash map that uses the `HashMapKey` of an entry as the comparator.
 *
 * JavaScript maps uses reference equality for keys. This is sometimes difficult
 * to work with, because the key must be the exact same instance as the one
 * stored in the map. This map uses the `toString()` value to determine
 * equality.
 */
export class HashMap<Key extends HashMapKey, Value> {
  private readonly map = new Map<string, [Key, Value]>();

  constructor(iterable?: Iterable<[Key, Value]>) {
    if (iterable !== undefined) {
      for (const [key, value] of iterable) {
        this.set(key, value);
      }
    }
  }

  set(key: Key, value: Value) {
    this.map.set(key.toString(), [key, value]);
  }

  has(key: Key): boolean {
    return this.map.has(key.toString());
  }

  get(key: Key): Value | undefined {
    const value = this.map.get(key.toString());
    if (value === undefined) {
      return undefined;
    }
    return value[1];
  }

  delete(key: Key): boolean {
    return this.map.delete(key.toString());
  }

  keys(): IterableIterator<Key> {
    return new KeyIterator(this.map.values());
  }

  values(): IterableIterator<Value> {
    return new ValueIterator(this.map.values());
  }

  entries(): IterableIterator<[Key, Value]> {
    return this.map.values();
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }

  /**
   * If the key is not present, adds the key and value to the map and returns
   * the value. Otherwise, returns the existing value.
   */
  putIfAbsent(key: Key, value: Value): Value {
    const existingValue = this.map.get(key.toString());
    if (existingValue !== undefined) {
      return existingValue[1];
    }
    this.map.set(key.toString(), [key, value]);
    return value;
  }
}

class KeyIterator<Key, Value> implements IterableIterator<Key> {
  constructor(private readonly iterator: IterableIterator<[Key, Value]>) {}

  next(): IteratorResult<Key> {
    const next = this.iterator.next();
    return {
      done: next.done,
      value: next.value?.[0],
    };
  }

  *[Symbol.iterator](): IterableIterator<Key> {
    for (const value of this.iterator) {
      yield value[0];
    }
  }
}

class ValueIterator<Key, Value> implements IterableIterator<Value> {
  constructor(private readonly iterator: IterableIterator<[Key, Value]>) {}

  next(): IteratorResult<Value> {
    const next = this.iterator.next();
    return {
      done: next.done,
      value: next.value[1],
    };
  }

  *[Symbol.iterator](): IterableIterator<Value> {
    for (const value of this.iterator) {
      yield value[1];
    }
  }
}

/**
 * The key of the hash map.
 */
export interface HashMapKey {
  toString(): string;
}
