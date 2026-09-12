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
  readonly start: number;
  readonly end: number;

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
 * All ranges for a given coordinate.
 */
type RangeGroup = Range[];

/**
 * Manages the vertical/horizontal ranges of the commit graph to make sure lines
 * don't overlap.
 */
export class RangeManager {
  /**
   * For a RangeManager used to reserve vertical lines:
   *  ranges[0] = all lines at x-coordinate 0.
   *  ranges[1] = all lines at x-coordinate 1.
   *  ranges[2] = all lines at x-coordinate 2.
   *  ...
   * For a RangeManager used to reserve horizontal lines:
   *  ranges[0] = all lines at y-coordinate 0.
   *  ranges[1] = all lines at y-coordinate 1.
   *  ...
   *  ranges[y] = all lines at y-coordinate y.
   */
  constructor(public rangeGroups: RangeGroup[] = []) {}

  /**
   * Reserves a new range at the given coordinate.
   *
   * @return Whether the range was reserved. If false, it means the range
   * overlaps with an existing range.
   */
  reserve(coordinate: number, newRange: Range): boolean {
    const ranges = this.getRangeGroup(coordinate);
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
    const cloned: Range[][] = [];
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

  private getRangeGroup(coordinate: number): RangeGroup {
    for (let i = this.rangeGroups.length; i <= coordinate; ++i) {
      this.rangeGroups.push([]);
    }
    return this.rangeGroups[coordinate];
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
  if (existingRange.start === newRange.start) {
    return (
      (existingRange.end - existingRange.start) *
        (newRange.end - newRange.start) >
      0
    );
  } else if (existingRange.start < newRange.start) {
    return existingRange.end > newRange.start;
  } else {
    return newRange.end > existingRange.start;
  }
}
