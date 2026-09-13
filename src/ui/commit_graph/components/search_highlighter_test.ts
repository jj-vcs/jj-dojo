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
import {calculateRanges, highlight, TEST_ONLY} from './search_highlighter';

const {resetRootElementForTesting} = TEST_ONLY;

class FakeRange {
  startContainer: Node | null = null;
  startOffset = 0;
  endContainer: Node | null = null;
  endOffset = 0;

  setStart(node: Node, offset: number) {
    this.startContainer = node;
    this.startOffset = offset;
  }

  setEnd(node: Node, offset: number) {
    this.endContainer = node;
    this.endOffset = offset;
  }
}

class FakeHighlight {
  readonly ranges: Range[];
  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}

function newFakeElement(
  options: {
    textContent?: string;
    tagName?: string;
    childNodes?: HTMLElement[];
    shadowRoot?: {childNodes: HTMLElement[]} | null;
    assignedNodes?: () => HTMLElement[];
    getMatches?: (query: Lowercase<string>) => Range[];
  } = {},
): HTMLElement {
  return {
    tagName: options.tagName ?? 'DIV',
    textContent: options.textContent ?? '',
    childNodes: options.childNodes ?? [],
    shadowRoot: options.shadowRoot ?? null,
    assignedNodes: options.assignedNodes,
    getMatches: options.getMatches,
  } as unknown as HTMLElement;
}

function setChildren(parent: HTMLElement, children: HTMLElement[]): void {
  (parent as unknown as {childNodes: HTMLElement[]}).childNodes = children;
}

describe('search_highlighter', () => {
  const GLOBALS = ['document', 'CSS', 'Range', 'Highlight'] as const;
  const savedGlobals: Record<string, unknown> = {};

  let highlights: Map<string, FakeHighlight>;
  let rootElement: HTMLElement | null;

  beforeEach(() => {
    const g = globalThis as Record<string, unknown>;
    for (const key of GLOBALS) {
      savedGlobals[key] = g[key];
    }

    highlights = new Map();
    rootElement = newFakeElement();

    g['document'] = {
      getElementById: (id: string) => (id === 'jj-app' ? rootElement : null),
    };
    g['CSS'] = {highlights};
    g['Range'] = FakeRange;
    g['Highlight'] = FakeHighlight;

    resetRootElementForTesting();
  });

  afterEach(() => {
    resetRootElementForTesting();
    const g = globalThis as Record<string, unknown>;
    for (const key of GLOBALS) {
      if (savedGlobals[key] === undefined) {
        delete g[key];
      } else {
        g[key] = savedGlobals[key];
      }
    }
  });

  describe('calculateRanges', () => {
    it('finds a single match within a single element', () => {
      const node = newFakeElement({textContent: 'Hello world!'});
      const ranges = calculateRanges([node], 'world');

      expect(ranges.length).toBe(1);
      const [range] = ranges;
      expect(range.startContainer).toBe(node);
      expect(range.startOffset).toBe(6);
      expect(range.endContainer).toBe(node);
      expect(range.endOffset).toBe(11);
    });

    it('finds multiple matches within the same element', () => {
      const node = newFakeElement({textContent: 'abc abc abc'});
      const ranges = calculateRanges([node], 'abc');

      expect(ranges.length).toBe(3);
      expect(ranges.map((r) => [r.startOffset, r.endOffset])).toEqual([
        [0, 3],
        [4, 7],
        [8, 11],
      ]);
    });

    it('performs case-insensitive matching', () => {
      const node = newFakeElement({textContent: 'FOO bar Foo BAR'});
      const ranges = calculateRanges([node], 'foo');

      expect(ranges.length).toBe(2);
      expect(ranges.map((r) => [r.startOffset, r.endOffset])).toEqual([
        [0, 3],
        [8, 11],
      ]);
    });

    it('finds matches spanning across multiple elements', () => {
      const node1 = newFakeElement({textContent: 'Hello '});
      const node2 = newFakeElement({textContent: 'world!'});
      const ranges = calculateRanges([node1, node2], 'o wor');

      expect(ranges.length).toBe(1);
      const [range] = ranges;
      expect(range.startContainer).toBe(node1);
      expect(range.startOffset).toBe(4);
      expect(range.endContainer).toBe(node2);
      expect(range.endOffset).toBe(3);
    });

    it('skips elements with empty textContent when resolving positions', () => {
      const node1 = newFakeElement({textContent: 'hello'});
      const emptyNode = newFakeElement({textContent: ''});
      const node2 = newFakeElement({textContent: 'world'});
      const ranges = calculateRanges([node1, emptyNode, node2], 'ow');

      expect(ranges.length).toBe(1);
      const [range] = ranges;
      expect(range.startContainer).toBe(node1);
      expect(range.startOffset).toBe(4);
      expect(range.endContainer).toBe(node2);
      expect(range.endOffset).toBe(1);
    });

    it('returns an empty array when query is not found', () => {
      const node = newFakeElement({textContent: 'some sample text'});
      expect(calculateRanges([node], 'xyz')).toEqual([]);
    });
  });

  describe('highlight', () => {
    it('clears highlights and returns empty array when query is empty', () => {
      highlights.set('search-matches', new FakeHighlight());

      expect(highlight('')).toEqual([]);
      expect(highlights.has('search-matches')).toBeFalse();
    });

    it('throws error when jj-app root element is missing', () => {
      rootElement = null;
      expect(() => highlight('test')).toThrowError(
        'could not find jj-app root element',
      );
    });

    it('finds matches in leaf children and registers them in CSS.highlights', () => {
      const child = newFakeElement({textContent: 'Target search match here'});
      setChildren(rootElement!, [child]);

      const matches = highlight('search');

      expect(matches.length).toBe(1);
      const [range] = matches;
      expect(range.startContainer).toBe(child);
      expect(range.startOffset).toBe(7);
      expect(range.endOffset).toBe(13);

      expect(highlights.get('search-matches')?.ranges).toEqual(matches);
    });

    it('clears highlights when query has no matches', () => {
      setChildren(rootElement!, [
        newFakeElement({textContent: 'Some matching text'}),
      ]);

      highlight('matching');
      expect(highlights.has('search-matches')).toBeTrue();

      const noMatches = highlight('nonexistent');
      expect(noMatches).toEqual([]);
      expect(highlights.has('search-matches')).toBeFalse();
    });

    it('converts query to lowercase', () => {
      setChildren(rootElement!, [
        newFakeElement({textContent: 'case Insensitive text'}),
      ]);

      const matches = highlight('INSENSITIVE');
      expect(matches.length).toBe(1);
      const [range] = matches;
      expect(range.startOffset).toBe(5);
      expect(range.endOffset).toBe(16);
    });

    it('traverses shadowRoot childNodes', () => {
      const shadowChild = newFakeElement({textContent: 'Inside shadow DOM'});
      setChildren(rootElement!, [
        newFakeElement({shadowRoot: {childNodes: [shadowChild]}}),
      ]);

      const matches = highlight('shadow');
      expect(matches.length).toBe(1);
      const [range] = matches;
      expect(range.startContainer).toBe(shadowChild);
      expect(range.startOffset).toBe(7);
      expect(range.endOffset).toBe(13);
    });

    it('traverses assignedNodes of SLOT elements', () => {
      const slottedChild = newFakeElement({
        textContent: 'Inside slotted node',
      });
      setChildren(rootElement!, [
        newFakeElement({
          tagName: 'SLOT',
          assignedNodes: () => [slottedChild],
        }),
      ]);

      const matches = highlight('slotted');
      expect(matches.length).toBe(1);
      const [range] = matches;
      expect(range.startContainer).toBe(slottedChild);
      expect(range.startOffset).toBe(7);
      expect(range.endOffset).toBe(14);
    });

    it('delegates to CustomMatcher getMatches when implemented and avoids recursing children', () => {
      const customRange = new FakeRange() as unknown as Range;
      const getMatchesSpy = jasmine
        .createSpy('getMatches')
        .and.returnValue([customRange]);

      setChildren(rootElement!, [
        newFakeElement({
          getMatches: getMatchesSpy,
          childNodes: [
            newFakeElement({textContent: 'Custom query ignored text'}),
          ],
        }),
      ]);

      const matches = highlight('Custom');

      expect(getMatchesSpy).toHaveBeenCalledWith('custom');
      expect(matches).toEqual([customRange]);
    });

    it('caches rootElement across calls until resetRootElementForTesting is called', () => {
      setChildren(rootElement!, [
        newFakeElement({textContent: 'Root content'}),
      ]);

      expect(highlight('root').length).toBe(1);

      // Remove jj-app reference — subsequent call still works via cached rootElement
      rootElement = null;
      expect(highlight('content').length).toBe(1);

      // After reset, calling highlight fails because jj-app is missing from document
      resetRootElementForTesting();
      expect(() => highlight('content')).toThrowError(
        'could not find jj-app root element',
      );
    });
  });
});
