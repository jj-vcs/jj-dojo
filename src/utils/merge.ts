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

/**
 * A generic representation of merged values.
 *
 * There is exactly one more `adds()` than `removes()`. When interpreted as a
 * series of diffs, the merge's (i+1)-st add is matched with the i-th
 * remove. The zeroth add is considered a diff from the non-existent state.
 */
export class Merge<T> {
  private constructor(
    private readonly mutableAdds: T[],
    private readonly mutableRemoves: T[],
  ) {}

  get adds(): readonly T[] {
    return this.mutableAdds;
  }

  get removes(): readonly T[] {
    return this.mutableRemoves;
  }

  /**
   * Converts an object from the single-list representation into Merge<T>
   * @param alternatingAddsAndRemoves The single-list representation of an object.
   * When there are no conflicts, this is a single element. Otherwise there are
   * an odd number of elements, with the 0th element representing the baseline,
   * and the (i * 2)th element representing an add based on the state of the
   * (i * 2 - 1)th element.
   */
  static fromAlternatingAddsAndRemoves<T>(
    alternatingAddsAndRemoves: readonly T[],
  ): Merge<T> {
    if (alternatingAddsAndRemoves.length % 2 !== 1) {
      throw new Error(
        `Expected odd number of elements; got ${alternatingAddsAndRemoves.length}`,
      );
    }
    const adds: T[] = [];
    const removes: T[] = [];
    for (let i = 0; i < alternatingAddsAndRemoves.length; ++i) {
      const vec = i % 2 === 0 ? adds : removes;
      vec.push(alternatingAddsAndRemoves[i]);
    }
    return new Merge(adds, removes);
  }

  /** Creates a merge object from a list of adds and removes. */
  static fromAddsAndRemoves<T>(
    adds: readonly T[],
    removes: readonly T[],
  ): Merge<T> {
    if (adds.length !== removes.length + 1) {
      throw new Error(
        `Expected adds.length to be removes.length + 1; got ${adds.length} adds and ${removes.length} removes`,
      );
    }
    return new Merge([...adds], [...removes]);
  }

  /**
   * Simplifies the merge by removing redundant paths.
   */
  simplify(equals: (a: T, b: T) => boolean) {
    let addIndex = 0;
    while (addIndex < this.mutableAdds.length) {
      const add = this.mutableAdds[addIndex];
      const removeIndex = this.mutableRemoves.findIndex((remove) =>
        equals(add, remove),
      );
      if (removeIndex !== -1) {
        this.mutableAdds[addIndex] = this.mutableAdds[removeIndex + 1];
        this.mutableRemoves.splice(removeIndex, 1);
        this.mutableAdds.splice(removeIndex + 1, 1);
      } else {
        addIndex++;
      }
    }
  }

  /** Converts a resolved (i.e. no conflicts) object into Merge<T>  */
  static fromResolved<T>(resolved: T): Merge<T> {
    return new Merge([resolved], []);
  }

  /** Returns true if Merge<T> has no conflicts */
  isResolved(): boolean {
    return this.mutableRemoves.length === 0;
  }

  /** Returns the resolved object. Returns `undefined` if there are conflicts. */
  asResolved(): T | undefined {
    return this.mutableRemoves.length === 0 ? this.mutableAdds[0] : undefined;
  }
}
