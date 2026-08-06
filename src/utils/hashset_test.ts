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
import {HashMapKey} from './hashmap';
import {HashSet} from './hashset';

class TestKey implements HashMapKey {
  constructor(private readonly value: string) {}
  toString() {
    return this.value;
  }
}

describe('HashSet', () => {
  it('finds elements correctly', () => {
    const set = new HashSet<TestKey>([new TestKey('key1')]);
    expect(set.has(new TestKey('key1'))).toBeTrue();
    expect(set.has(new TestKey('key2'))).toBeFalse();
  });

  it('iterates correctly', () => {
    const set = new HashSet<TestKey>([
      new TestKey('key1'),
      new TestKey('key2'),
      new TestKey('key3'),
    ]);
    const keys = [];
    for (const key of set) {
      keys.push(key);
    }
    expect(keys.length).toEqual(3);
    expect(keys).toContain(new TestKey('key1'));
    expect(keys).toContain(new TestKey('key2'));
    expect(keys).toContain(new TestKey('key3'));
  });
});
