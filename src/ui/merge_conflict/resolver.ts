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
 * Returns the resolved text for a given range.
 *
 * @param unresolvedText The unresolved text. An example is:
 * %%%%%%% Changes from base to side #1
 *  apple
 * -grape
 * +grapefruit
 *  orange
 *
 * @return The resolved text that should be shown in the editor after accepting a side.
 * Using the example above, the resolved text should be:
 * apple
 * grapefruit
 * orange
 */
export function getResolvedText(unresolvedText: string): string {
  const lines = unresolvedText.split('\n');

  // The first line is always metadata that should be excluded.
  // e.g. ++++++ Contents of side #1
  const firstLine = lines.shift();

  // If the first line starts with %%%%%%% and the second line starts with
  // \\\\\\\, then the second line is also a metadata line.
  // e.g.
  // %%%%%%% diff from:
  // \\\\\\\        to: side #1
  if (
    firstLine?.startsWith('%%%%%%%') &&
    lines.length > 0 &&
    lines[0].startsWith('\\\\\\\\\\\\\\')
  ) {
    lines.shift();
  }

  if (
    firstLine?.startsWith('+++++++') ||
    !firstCharacterIsMetadataForAllLines(lines)
  ) {
    return lines.join('\n');
  }

  const resolvedLines: string[] = [];
  for (const line of lines) {
    if (line.charAt(0) === '-') {
      continue;
    } else {
      resolvedLines.push(line.substring(1));
    }
  }
  return resolvedLines.join('\n');
}

/**
 * A helper function to get the resolved text for all sides.
 *
 * @param unresolvedTexts The unresolved texts for all sides.
 * @return The resolved text that should be shown in the editor after accepting all sides.
 */
export function getResolvedTextForAllSides(unresolvedTexts: string[]): string {
  const resolvedTexts: string[] = [];
  for (const unresolvedText of unresolvedTexts) {
    const resolvedText = getResolvedText(unresolvedText);
    if (resolvedText.length > 0) {
      resolvedTexts.push(resolvedText);
    }
  }
  return resolvedTexts.join('\n');
}

/**
 * Returns true if the first character of all lines are + or - or an empty space.
 *
 * If the user has manually removed any metadata characters (e.g. the empty spaces),
 * it's impossible/difficult for us to know whether the first character of any
 * line is a metadata character or not.
 *
 * So if we detect that any line starts with a non-metadata character, we simply
 * don't try to remove any metadata characters when auto-resolving conflicts.
 *
 * @param lines The lines to check.
 * @return True if the first character of each line is metadata.
 */
function firstCharacterIsMetadataForAllLines(lines: string[]) {
  for (const line of lines) {
    if (line.length > 0) {
      const character = line.charAt(0);
      if (character !== ' ' && character !== '+' && character !== '-') {
        return false;
      }
    }
  }
  return true;
}
