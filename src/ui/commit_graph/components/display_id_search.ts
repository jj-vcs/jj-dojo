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
 * Returns the number of characters in `displayId` to highlight when `query`
 * matches as a prefix of `displayId` or `changeId`, or `undefined` if there is
 * no match.
 *
 * Assumes `displayId` and `changeId` are already lowercase to avoid allocating
 * lowercased strings on every row during search.
 */
export function getDisplayIdHighlightLength(
  displayId: string,
  changeId: string | undefined,
  query: Lowercase<string>,
): number | undefined {
  if (!query || !displayId) {
    return undefined;
  }
  if (displayId.startsWith(query)) {
    return query.length;
  }
  if (!changeId) {
    return undefined;
  }
  const slashIndex = displayId.indexOf('/');
  const displayedPrefix =
    slashIndex === -1 ? displayId : displayId.substring(0, slashIndex);
  if (!displayedPrefix || !changeId.startsWith(displayedPrefix)) {
    return undefined;
  }
  if (changeId.startsWith(query)) {
    return displayedPrefix.length;
  }
  if (slashIndex !== -1) {
    const querySlashIndex = query.indexOf('/');
    // Require `querySlashIndex > displayedPrefix.length`: equal length is
    // already matched by `displayId.startsWith(query)`, and shorter
    // prefixes (e.g. `tr/0` on `trvw/0`) would highlight unmatched characters
    // before `/` since search returns a single contiguous Range from index 0.
    if (querySlashIndex > displayedPrefix.length) {
      const queryPrefix = query.substring(0, querySlashIndex);
      const querySuffix = query.substring(querySlashIndex);
      const displaySuffix = displayId.substring(slashIndex);
      if (
        changeId.startsWith(queryPrefix) &&
        displaySuffix.startsWith(querySuffix)
      ) {
        return slashIndex + querySuffix.length;
      }
    }
  }
  return undefined;
}
