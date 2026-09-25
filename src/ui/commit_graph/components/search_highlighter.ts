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

// The root element never changes. Cache it here to avoid unnecessary lookups.
let rootElement: HTMLElement | null;

/**
 * By default, the search highlighter will use the textContent inside
 * an HTMLElement for text matching. HTMLElements can overrride the
 * search by implementing getMatches.
 */
export interface CustomMatcher {
  /**
   * Given a query string, return the Ranges of text that should be
   * highlighted
   */
  getMatches?(query: Lowercase<string>): Range[];
}

/**
 * Given a query string, highlight all elements in jj-app that includes
 * the query string.
 */
export function highlight(query: string): Range[] {
  if (!query) {
    CSS.highlights.clear();
    return [];
  }
  if (!rootElement) {
    rootElement = document.getElementById('jj-app');
    if (!rootElement) {
      throw new Error('could not find jj-app root element');
    }
  }

  // Find all matching elements
  const matches: Range[] = [];
  findMatchesRecursively(
    matches,
    query.toLowerCase() as Lowercase<string>,
    rootElement,
  );

  // Register the ranges to create the visual highlights
  CSS.highlights.clear();
  if (matches.length > 0) {
    CSS.highlights.set('search-matches', new Highlight(...matches));
  }
  return matches;
}

function findMatchesRecursively(
  matches: Range[],
  query: Lowercase<string>,
  element: HTMLElement & CustomMatcher,
) {
  let childNodes: NodeListOf<Node> | Node[];

  if (element.getMatches) {
    matches.push(...element.getMatches(query));
    return;
  } else if (element.shadowRoot) {
    childNodes = element.shadowRoot.childNodes;
  } else if (element.tagName === 'SLOT') {
    childNodes = (element as HTMLSlotElement).assignedNodes({flatten: true});
  } else {
    childNodes = element.childNodes;
  }

  if (childNodes.length === 0) {
    matches.push(...calculateRanges([element], query));
    return;
  }

  for (const child of childNodes) {
    findMatchesRecursively(matches, query, child as HTMLElement);
  }
}

/**
 * Given a list of HTML nodes and a query, find the matches.
 * This function supports finding text that spans across multiple elements.
 */
export function calculateRanges(
  elements: Node[],
  query: Lowercase<string>,
): Range[] {
  let text = '';
  for (const element of elements) {
    text += element.textContent;
  }
  text = text.toLowerCase();

  // Create ranges for all matches
  const ranges: Range[] = [];

  let startIndex = 0;
  // Loop through the text node to catch all matches in the same node
  while (startIndex < text.length) {
    const matchIndex = text.indexOf(query, startIndex);
    if (matchIndex === -1) {
      break;
    }
    const range = new Range();
    range.setStart(...getRangePosition(elements, matchIndex));
    range.setEnd(...getRangePosition(elements, matchIndex + query.length));
    ranges.push(range);
    // Advance past current match
    startIndex = matchIndex + query.length;
  }
  return ranges;
}

function getRangePosition(elements: Node[], index: number): [Node, number] {
  for (const element of elements) {
    const textContent = element.textContent;
    if (!textContent) {
      continue;
    }
    if (index <= textContent.length) {
      return [element, index];
    }
    index -= textContent.length;
  }
  throw new Error(
    `Invalid range position ${index} among ${JSON.stringify(elements)}`,
  );
}

export const TEST_ONLY = {
  resetRootElementForTesting,
};

/**
 * Resets the cached root element. Intended for testing only to prevent state
 * leakage across tests.
 */
function resetRootElementForTesting(): void {
  rootElement = null;
}
