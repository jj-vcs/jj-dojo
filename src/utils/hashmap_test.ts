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

class TestKey implements HashMapKey {
  constructor(private readonly value: string) {}
  toString() {
    return this.value;
  }
}

describe('HashMap', () => {
  it('finds the value', () => {
    const map = new HashMap<TestKey, string>();
    map.set(new TestKey('key'), 'value');
    // Finds the value using the same key but a different instance.
    expect(map.get(new TestKey('key'))).toEqual('value');

    // Sets the value correctly.
    map.set(new TestKey('key'), 'value2');
    expect(map.get(new TestKey('key'))).toEqual('value2');
  });

  it('iterates correctly', () => {
    const map = new HashMap<TestKey, string>();
    const key1 = new TestKey('key1');
    const key2 = new TestKey('key2');
    const key3 = new TestKey('key3');
    map.set(key1, 'value1');
    map.set(key2, 'value2');
    map.set(key3, 'value3');

    const keys = [];
    for (const key of map.keys()) {
      keys.push(key);
    }
    expect(keys.length).toEqual(3);
    expect(keys).toContain(key1);
    expect(keys).toContain(key2);
    expect(keys).toContain(key3);

    const values = [];
    for (const value of map.values()) {
      values.push(value);
    }
    expect(values.length).toEqual(3);
    expect(values).toContain('value1');
    expect(values).toContain('value2');
    expect(values).toContain('value3');

    const entries = [];
    for (const [key, value] of map.entries()) {
      entries.push([key, value]);
    }
    expect(entries.length).toEqual(3);
    expect(entries).toContain([key1, 'value1']);
    expect(entries).toContain([key2, 'value2']);
    expect(entries).toContain([key3, 'value3']);
  });

  it('putIfAbsent works correctly', () => {
    const map = new HashMap<TestKey, string>();
    expect(map.putIfAbsent(new TestKey('key'), 'value')).toEqual('value');
    expect(map.putIfAbsent(new TestKey('key'), 'value2')).toEqual('value');
  });
});
