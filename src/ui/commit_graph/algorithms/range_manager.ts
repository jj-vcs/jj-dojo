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
 * Represents a vertical range of the commit graph.
 */
export interface Range {
  readonly yStart: number;
  readonly yEnd: number;

  readonly parentHash: string;
  readonly childHash: string;

  // By default, ranges are considered non-overlapping if their `yStart` or
  // `yEnd` don't overlap. If `canBeSharedBy` returns true, then two ranges are
  // considered non-overlapping regardless of their `yStart` or `yEnd`.
  //
  // This is useful when two ranges are allowed to overlap. e.g. In the
  // following graph, range1 represents the line between A and C. range2
  // represents the line between B and C. It's fine for them to overlap.
  //  o
  //  ├─┐
  //  o │
  //  │ │    o C
  //  │ │    | <-- range1 (overlapped with range2)
  //  │ o A ─┘ <-- range1 (overlapped with range2)
  //  ├─┘    │ <-- range2
  //  │      o B
  //  ├──────┘
  //  o A
  readonly canBeSharedBy: (existingRange: Range, newRange: Range) => boolean;
}

/**
 * All ranges for a given x-coordinate.
 */
type RangeGroup = Range[];

/**
 * Manages the vertical ranges of the commit graph to make sure they don't
 * overlap.
 */
export class RangeManager {
  /**
   * @param rangeGroups A map of x-coordinate to all ranges for that x-coordinate.
   */
  constructor(public rangeGroups: RangeGroup[] = []) {}

  /**
   * Reserves a new range at the given x-coordinate.
   *
   * @return Whether the range was reserved. If false, it means the range
   * overlaps with an existing range.
   */
  reserve(x: number, newRange: Range): boolean {
    const ranges = this.getRangeGroup(x);
    if (hasOverlap(ranges, newRange)) {
      return false;
    }
    ranges.push(newRange);
    return true;
  }

  /**
   * Performs a deep copy of the range manager.
   */
  clone(): RangeManager {
    const cloned: RangeGroup[] = [];
    for (const rangeGroup of this.rangeGroups) {
      cloned.push([...rangeGroup]);
    }
    return new RangeManager(cloned);
  }

  /**
   * Replaces the range groups with the given range groups.
   */
  replace(rangeGroups: RangeGroup[]) {
    this.rangeGroups = rangeGroups;
  }

  private getRangeGroup(x: number): RangeGroup {
    for (let i = this.rangeGroups.length; i <= x; ++i) {
      this.rangeGroups.push([]);
    }
    return this.rangeGroups[x];
  }
}

function hasOverlap(existingRanges: Range[], newRange: Range) {
  for (const existingRange of existingRanges) {
    if (hasOverlapBetweenRanges(existingRange, newRange)) {
      return true;
    }
  }
  return false;
}

function hasOverlapBetweenRanges(existingRange: Range, newRange: Range) {
  if (existingRange.canBeSharedBy(existingRange, newRange)) {
    return false;
  }
  if (existingRange.yStart === newRange.yStart) {
    return (
      (existingRange.yEnd - existingRange.yStart) *
        (newRange.yEnd - newRange.yStart) >
      0
    );
  } else if (existingRange.yStart < newRange.yStart) {
    return existingRange.yEnd > newRange.yStart;
  } else {
    return newRange.yEnd > existingRange.yStart;
  }
}
