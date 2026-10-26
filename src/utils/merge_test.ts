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

import {Merge} from './merge';

describe('Merge', () => {
  describe('fromResolved', () => {
    it('creates a resolved merge', () => {
      const merge = Merge.fromResolved('a');
      expect(merge.adds).toEqual(['a']);
      expect(merge.removes).toEqual([]);
      expect(merge.isResolved()).toBeTrue();
      expect(merge.asResolved()).toBe('a');
    });
  });

  describe('fromAlternatingAddsAndRemoves', () => {
    it('creates a resolved merge from a single element', () => {
      const merge = Merge.fromAlternatingAddsAndRemoves(['a']);
      expect(merge.adds).toEqual(['a']);
      expect(merge.removes).toEqual([]);
      expect(merge.isResolved()).toBeTrue();
      expect(merge.asResolved()).toBe('a');
    });

    it('splits alternating adds and removes for a conflicted merge', () => {
      const merge = Merge.fromAlternatingAddsAndRemoves([
        'add0',
        'remove0',
        'add1',
        'remove1',
        'add2',
      ]);
      expect(merge.adds).toEqual(['add0', 'add1', 'add2']);
      expect(merge.removes).toEqual(['remove0', 'remove1']);
      expect(merge.isResolved()).toBeFalse();
      expect(merge.asResolved()).toBeUndefined();
    });

    it('throws when given an even number of elements', () => {
      expect(() => Merge.fromAlternatingAddsAndRemoves([])).toThrowError(
        'Expected odd number of elements; got 0',
      );
      expect(() =>
        Merge.fromAlternatingAddsAndRemoves(['a', 'b']),
      ).toThrowError('Expected odd number of elements; got 2');
      expect(() =>
        Merge.fromAlternatingAddsAndRemoves(['a', 'b', 'c', 'd']),
      ).toThrowError('Expected odd number of elements; got 4');
    });
  });

  describe('fromAddsAndRemoves', () => {
    it('creates a resolved merge when removes is empty', () => {
      const merge = Merge.fromAddsAndRemoves(['a'], []);
      expect(merge.adds).toEqual(['a']);
      expect(merge.removes).toEqual([]);
      expect(merge.isResolved()).toBeTrue();
      expect(merge.asResolved()).toBe('a');
    });

    it('creates a conflicted merge when removes is non-empty', () => {
      const merge = Merge.fromAddsAndRemoves(['a', 'c'], ['b']);
      expect(merge.adds).toEqual(['a', 'c']);
      expect(merge.removes).toEqual(['b']);
      expect(merge.isResolved()).toBeFalse();
      expect(merge.asResolved()).toBeUndefined();
    });

    it('does not retain references to the input arrays', () => {
      const adds = ['a', 'b'];
      const removes = ['a'];
      const merge = Merge.fromAddsAndRemoves(adds, removes);

      adds.push('c');
      removes.push('d');
      expect(merge.adds).toEqual(['a', 'b']);
      expect(merge.removes).toEqual(['a']);

      merge.simplify((a, b) => a === b);
      expect(adds).toEqual(['a', 'b', 'c']);
      expect(removes).toEqual(['a', 'd']);
    });

    it('throws when adds.length !== removes.length + 1', () => {
      expect(() => Merge.fromAddsAndRemoves([], [])).toThrowError(
        'Expected adds.length to be removes.length + 1; got 0 adds and 0 removes',
      );
      expect(() => Merge.fromAddsAndRemoves(['a', 'b'], [])).toThrowError(
        'Expected adds.length to be removes.length + 1; got 2 adds and 0 removes',
      );
      expect(() => Merge.fromAddsAndRemoves(['a'], ['b'])).toThrowError(
        'Expected adds.length to be removes.length + 1; got 1 adds and 1 removes',
      );
    });
  });

  describe('simplify', () => {
    const strEquals = (a: string, b: string) => a === b;

    it('keeps an already resolved merge unchanged', () => {
      const merge = Merge.fromResolved('a');
      merge.simplify(strEquals);
      expect(merge.adds).toEqual(['a']);
      expect(merge.removes).toEqual([]);
      expect(merge.isResolved()).toBeTrue();
      expect(merge.asResolved()).toBe('a');
    });

    it('keeps an irreducibly conflicted merge unchanged', () => {
      const merge = Merge.fromAddsAndRemoves(['a', 'c'], ['b']);
      merge.simplify(strEquals);
      expect(merge.adds).toEqual(['a', 'c']);
      expect(merge.removes).toEqual(['b']);
      expect(merge.isResolved()).toBeFalse();
      expect(merge.asResolved()).toBeUndefined();
    });

    it('simplifies when the first add matches the remove', () => {
      const merge = Merge.fromAddsAndRemoves(['a', 'b'], ['a']);
      merge.simplify(strEquals);
      expect(merge.adds).toEqual(['b']);
      expect(merge.removes).toEqual([]);
      expect(merge.isResolved()).toBeTrue();
      expect(merge.asResolved()).toBe('b');
    });

    it('simplifies when the second add matches the remove', () => {
      const merge = Merge.fromAddsAndRemoves(['b', 'a'], ['a']);
      merge.simplify(strEquals);
      expect(merge.adds).toEqual(['b']);
      expect(merge.removes).toEqual([]);
      expect(merge.isResolved()).toBeTrue();
      expect(merge.asResolved()).toBe('b');
    });

    it('resolves a multi-way merge when all removes cancel out', () => {
      const merge = Merge.fromAddsAndRemoves(['a', 'b', 'c'], ['a', 'b']);
      merge.simplify(strEquals);
      expect(merge.adds).toEqual(['c']);
      expect(merge.removes).toEqual([]);
      expect(merge.isResolved()).toBeTrue();
      expect(merge.asResolved()).toBe('c');
    });

    it('partially simplifies while preserving add/remove diff pairing', () => {
      // Diffs: 'a' + ('b' - 'c') + ('c' - 'x') + ('d' - 'y')
      // Cancelling 'c' pairs 'b' with 'x', leaving 'a' + ('b' - 'x') + ('d' - 'y').
      const merge = Merge.fromAddsAndRemoves(
        ['a', 'b', 'c', 'd'],
        ['c', 'x', 'y'],
      );
      merge.simplify(strEquals);
      expect(merge.adds).toEqual(['a', 'b', 'd']);
      expect(merge.removes).toEqual(['x', 'y']);
      expect(merge.isResolved()).toBeFalse();
    });

    it('uses the provided equality function', () => {
      const merge = Merge.fromAddsAndRemoves(
        [
          {id: 1, label: 'first'},
          {id: 2, label: 'second'},
        ],
        [{id: 1, label: 'different-label'}],
      );
      merge.simplify((a, b) => a.id === b.id);
      expect(merge.isResolved()).toBeTrue();
      expect(merge.asResolved()).toEqual({id: 2, label: 'second'});
    });
  });
});
