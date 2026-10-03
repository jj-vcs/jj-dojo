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
import {TOP_BAR_HEIGHT} from './constants';
import {
  calculateRanges,
  highlight,
  scrollRangeIntoView,
  TEST_ONLY,
} from './search_highlighter';

const {resetRootElementForTesting} = TEST_ONLY;

class FakeRange {
  startContainer: Node | null = null;
  startOffset = 0;
  endContainer: Node | null = null;
  endOffset = 0;
  clientRects: DOMRect[] = [];

  getClientRects(): DOMRect[] {
    return this.clientRects;
  }

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

// Mock Node in tests. In the future, if we need a more realistic/complicated setup,
// we can use a third party library like jsdom instead of mocking it ourselves.
class FakeNode {
  static readonly ELEMENT_NODE = 1;
  static readonly ATTRIBUTE_NODE = 2;
  static readonly TEXT_NODE = 3;
  static readonly CDATA_SECTION_NODE = 4;
  static readonly ENTITY_REFERENCE_NODE = 5;
  static readonly ENTITY_NODE = 6;
  static readonly PROCESSING_INSTRUCTION_NODE = 7;
  static readonly COMMENT_NODE = 8;
  static readonly DOCUMENT_NODE = 9;
  static readonly DOCUMENT_TYPE_NODE = 10;
  static readonly DOCUMENT_FRAGMENT_NODE = 11;
  static readonly NOTATION_NODE = 12;
}

function newFakeElement(
  options: {
    textContent?: string;
    tagName?: string;
    nodeType?: number;
    childNodes?: HTMLElement[];
    shadowRoot?: {childNodes: HTMLElement[]} | null;
    assignedNodes?: () => HTMLElement[];
    getMatches?: (query: Lowercase<string>) => Range[];
  } = {},
): HTMLElement {
  return {
    tagName: options.tagName ?? 'DIV',
    textContent: options.textContent ?? '',
    nodeType: options.nodeType ?? FakeNode.ELEMENT_NODE,
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
  const GLOBALS = [
    'document',
    'CSS',
    'Range',
    'Highlight',
    'Node',
    'window',
  ] as const;
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
    g['Node'] = FakeNode;

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

    it('skips comment nodes', () => {
      const commentChild = newFakeElement({
        nodeType: FakeNode.COMMENT_NODE,
        textContent: 'ignored comment match',
      });
      const validChild = newFakeElement({
        textContent: 'valid match',
      });
      setChildren(rootElement!, [commentChild, validChild]);

      const matches = highlight('match');
      expect(matches.length).toBe(1);
      expect(matches[0].startContainer).toBe(validChild);
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

  describe('scrollRangeIntoView', () => {
    let scrollToSpy: jasmine.Spy;
    const TOP_PADDING = TOP_BAR_HEIGHT + 8; // 43px
    const BOTTOM_PADDING = 16;
    const VIEWPORT_HEIGHT = 800;
    const INITIAL_SCROLL_Y = 200;

    beforeEach(() => {
      scrollToSpy = jasmine.createSpy('scrollTo');
      (globalThis as unknown as {window: unknown}).window = {
        scrollTo: scrollToSpy,
        scrollY: INITIAL_SCROLL_Y,
        innerHeight: VIEWPORT_HEIGHT,
      };
    });

    function createRangeWithRect(rect: Partial<DOMRect> | null): Range {
      const range = new FakeRange();
      range.clientRects = rect ? [rect as DOMRect] : [];
      return range as unknown as Range;
    }

    it('updates CSS highlights with current match', () => {
      const range = createRangeWithRect(null);
      scrollRangeIntoView(range);

      expect(highlights.has('search-current-match')).toBeTrue();
      expect(highlights.get('search-current-match')?.ranges).toEqual([range]);
    });

    it('does not scroll if getClientRects is empty', () => {
      const range = createRangeWithRect(null);
      scrollRangeIntoView(range);

      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it('does not scroll if element is already comfortably in view', () => {
      // rect.top (100) >= TOP_PADDING (43) and rect.bottom (124) <= VIEWPORT_HEIGHT - 16 (784)
      const range = createRangeWithRect({top: 100, bottom: 124, height: 24});
      scrollRangeIntoView(range);

      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it('scrolls up if element is hidden behind or above the sticky header', () => {
      // rect.top is 20px, which is < TOP_PADDING (43px)
      const range = createRangeWithRect({top: 20, bottom: 44, height: 24});
      scrollRangeIntoView(range);

      expect(scrollToSpy).toHaveBeenCalledWith({
        top: INITIAL_SCROLL_Y + 20 - TOP_PADDING,
        behavior: 'instant',
      });
    });

    it('scrolls down if element is below the viewport', () => {
      // rect.bottom is 850px, which is > VIEWPORT_HEIGHT - BOTTOM_PADDING (784px)
      const range = createRangeWithRect({top: 826, bottom: 850, height: 24});
      scrollRangeIntoView(range);

      expect(scrollToSpy).toHaveBeenCalledWith({
        top: INITIAL_SCROLL_Y + 850 - VIEWPORT_HEIGHT + BOTTOM_PADDING,
        behavior: 'instant',
      });
    });
  });
});
