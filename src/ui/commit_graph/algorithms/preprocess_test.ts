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
import {Commit, CommitNode, Line, LineType} from '../api/types';
import {createCommitNodes} from './preprocess';
import {newCommit} from './test_utils';

function childrenOf(nodesMap: Map<string, CommitNode>, hash: string) {
  return nodesMap.get(hash)?.children.map((child) => child.node.hash);
}

function coordinatesOf(nodesMap: Map<string, CommitNode>, commits: Commit[]) {
  return commits.map((commit) => [
    commit.hash,
    nodesMap.get(commit.hash)?.x,
    nodesMap.get(commit.hash)?.y,
  ]);
}

function uniqueLineTypes(lines: Line[]): Set<LineType> {
  return new Set(lines.map((line) => line.type));
}

function linesOf(nodesMap: Map<string, CommitNode>, hash: string) {
  return nodesMap.get(hash)?.tileGroups.map((tileGroup) => ({
    top: uniqueLineTypes(tileGroup.top.lines),
    glyph: uniqueLineTypes(tileGroup.glyph.lines),
    bottom: uniqueLineTypes(tileGroup.bottom.lines),
  }));
}

function insertActionsOf(nodesMap: Map<string, CommitNode>, hash: string) {
  return nodesMap.get(hash)?.tileGroups.map((tileGroup) => ({
    top: tileGroup.top.insertAction
      ? {
          from: tileGroup.top.insertAction.from?.hash,
          to: tileGroup.top.insertAction.to?.hash,
          insertNode: tileGroup.top.insertAction.insertNode,
          insertHint: tileGroup.top.insertAction.insertHint,
        }
      : undefined,
    glyph: tileGroup.glyph.insertAction
      ? {
          from: tileGroup.glyph.insertAction.from?.hash,
          to: tileGroup.glyph.insertAction.to?.hash,
          insertNode: tileGroup.glyph.insertAction.insertNode,
          insertHint: tileGroup.glyph.insertAction.insertHint,
        }
      : undefined,
    bottom: tileGroup.bottom.insertAction
      ? {
          from: tileGroup.bottom.insertAction.from?.hash,
          to: tileGroup.bottom.insertAction.to?.hash,
          insertNode: tileGroup.bottom.insertAction.insertNode,
          insertHint: tileGroup.bottom.insertAction.insertHint,
        }
      : undefined,
  }));
}

describe('createCommitNodes', () => {
  it('returns a map of commit nodes correctly', () => {
    const commits = [
      newCommit('a', ['b', 'c']),
      newCommit('b', []),
      newCommit('c', []),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(nodesMap.size).toEqual(3);
    expect(childrenOf(nodesMap, 'a')).toEqual(['b', 'c']);
    expect(childrenOf(nodesMap, 'b')).toEqual([]);
    expect(childrenOf(nodesMap, 'c')).toEqual([]);
  });

  it('throws an error if a child is not present in the commits array', () => {
    const commits = [newCommit('a', ['b', 'c']), newCommit('b', [])];
    expect(() => {
      createCommitNodes(commits);
    }).toThrowError(
      'Commit a has child c which is not present in the commits array.',
    );
  });

  it('optimizes the children order correctly - simple case', () => {
    // This is the same example as in the optimizeChildrenOrder function
    // comment.
    // Original graph:
    //  o c
    //  ├───┐
    //  o   │ b
    //  │   │
    //  │ o │ d
    //  ├─┘ |
    //  │   o e
    //  ├───┘
    //  o a
    //
    // New graph:
    // o c
    // ├─┐
    // o │ b
    // │ │
    // │ o e
    // ├─┘
    // │ o d
    // ├─┘
    // o a
    const commits = [
      newCommit('a', ['b', 'd', 'e']),
      newCommit('b', ['c']),
      newCommit('c', []),
      newCommit('d', []),
      newCommit('e', ['c']),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(childrenOf(nodesMap, 'a')).toEqual(['b', 'e', 'd']);
    expect(coordinatesOf(nodesMap, commits)).toEqual([
      ['a', 0, 0],
      ['b', 0, 3],
      ['c', 0, 4],
      ['d', 1, 1],
      ['e', 1, 2],
    ]);

    expect(nodesMap.get('a')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('b')?.occupiedColumns).toEqual(2);
    expect(nodesMap.get('c')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('d')?.occupiedColumns).toEqual(2);
    expect(nodesMap.get('e')?.occupiedColumns).toEqual(2);

    expect(linesOf(nodesMap, 'a')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'd')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'e')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'b')).toEqual([
      {
        top: new Set([LineType.LEFT_TO_UP, LineType.VERTICAL]),
        glyph: new Set([]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'c')).toEqual([
      {
        top: new Set(),
        glyph: new Set([]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
  });

  it('optimizes the children order correctly - complicated case', () => {
    // This is a more complicated example. It requires two iterations of the
    // optimization algorithm to reach the optimal order.
    // Initially, the graph looks like this:
    //  o c
    //  ├──────────┐
    //  o b        │
    //  │          │
    //  │  o e     │
    //  │  ├───┐   │
    //  │  │   │   │
    //  │  o d │   │
    //  │  │   o g │
    //  │  │   │   │
    //  │  │   │   o h
    //  │  │   ├───┘
    //  ├──┘   │
    //  │      o  f
    //  ├──────┘
    //  o a
    //
    // The first iteration would swap d and f, because f merges back sooner.
    // The second iteration would swap g and h, because h merges back sooner.
    // The final order is:
    //  o c
    //  ├───┐
    //  o b │
    //  │   o h
    //  │   │
    //  │   │   o e
    //  │   │   ├───┐
    //  │   │   o g │
    //  │   ├───┘   │
    //  │   o f     │
    //  ├───┘       │
    //  │           o d
    //  ├───────────┘
    //  o a
    const commits = [
      newCommit('a', ['b', 'd', 'f']),
      newCommit('b', ['c']),
      newCommit('c', []),
      newCommit('d', ['e']),
      newCommit('e', []),
      newCommit('f', ['g', 'h']),
      newCommit('g', ['e']),
      newCommit('h', ['c']),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(childrenOf(nodesMap, 'a')).toEqual(['b', 'f', 'd']);
    expect(childrenOf(nodesMap, 'f')).toEqual(['h', 'g']);
    expect(coordinatesOf(nodesMap, commits)).toEqual([
      ['a', 0, 0],
      ['b', 0, 6],
      ['c', 0, 7],
      ['d', 3, 1],
      ['e', 2, 4],
      ['f', 1, 2],
      ['g', 2, 3],
      ['h', 1, 5],
    ]);

    expect(nodesMap.get('a')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('b')?.occupiedColumns).toEqual(2);
    expect(nodesMap.get('c')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('d')?.occupiedColumns).toEqual(4);
    expect(nodesMap.get('e')?.occupiedColumns).toEqual(3);
    expect(nodesMap.get('f')?.occupiedColumns).toEqual(4);
    expect(nodesMap.get('g')?.occupiedColumns).toEqual(4);
    expect(nodesMap.get('h')?.occupiedColumns).toEqual(2);

    expect(linesOf(nodesMap, 'a')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.HORIZONTAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.HORIZONTAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'd')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'f')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'g')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.LEFT_TO_UP, LineType.VERTICAL]),
        glyph: new Set([]),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'e')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set(),
        glyph: new Set([]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'b')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.LEFT_TO_UP]),
        glyph: new Set([]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'c')).toEqual([
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
  });

  it('optimizes the children order correctly - criss cross merges', () => {
    //  o d
    //  ├───┐
    //  o c │
    //  ├───│───┐
    //  │   o e │
    //  ├───┤   │
    //  o b │   │
    //  │   ├───┘
    //  │   o f
    //  ├───┘
    //  o a
    const commits = [
      newCommit('a', ['b', 'f']),
      newCommit('b', ['c', 'e']),
      newCommit('c', ['d']),
      newCommit('d', []),
      newCommit('e', ['d']),
      newCommit('f', ['c', 'e']),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(childrenOf(nodesMap, 'a')).toEqual(['b', 'f']);
    expect(childrenOf(nodesMap, 'b')).toEqual(['c', 'e']);
    expect(childrenOf(nodesMap, 'f')).toEqual(['c', 'e']);
    expect(coordinatesOf(nodesMap, commits)).toEqual([
      ['a', 0, 0],
      ['b', 0, 2],
      ['c', 0, 4],
      ['d', 0, 5],
      ['e', 1, 3],
      ['f', 1, 1],
    ]);

    expect(nodesMap.get('a')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('b')?.occupiedColumns).toEqual(3);
    expect(nodesMap.get('c')?.occupiedColumns).toEqual(2);
    expect(nodesMap.get('d')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('e')?.occupiedColumns).toEqual(3);
    expect(nodesMap.get('f')?.occupiedColumns).toEqual(2);

    expect(linesOf(nodesMap, 'a')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'f')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'b')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set([]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL, LineType.RIGHT_TO_UP]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'e')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.LEFT_TO_UP]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL, LineType.HORIZONTAL]),
        glyph: new Set([]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'c')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.LEFT_TO_UP]),
        glyph: new Set([]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'd')).toEqual([
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
  });

  it('sorts the children order correctly when there are redundant lines - simple case', () => {
    // There are two redundant lines in the graph: a to c, and b to d.
    // Graph:
    //  o d
    //  ├─┐
    //  o │ c
    //  ├─┐
    //  │ o b
    //  ├─┘
    //  o a
    const commits = [
      newCommit('a', ['b', 'c']),
      newCommit('b', ['c', 'd']),
      newCommit('c', ['d']),
      newCommit('d', []),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(childrenOf(nodesMap, 'a')).toEqual(['c', 'b']);
    expect(coordinatesOf(nodesMap, commits)).toEqual([
      ['a', 0, 0],
      ['b', 1, 1],
      ['c', 0, 2],
      ['d', 0, 3],
    ]);
    expect(nodesMap.get('a')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('b')?.occupiedColumns).toEqual(2);
    expect(nodesMap.get('c')?.occupiedColumns).toEqual(2);
    expect(nodesMap.get('d')?.occupiedColumns).toEqual(1);

    expect(linesOf(nodesMap, 'a')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'b')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.LEFT_TO_UP]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT, LineType.VERTICAL]),
        glyph: new Set([]),
        bottom: new Set([]),
      },
    ]);
    expect(linesOf(nodesMap, 'c')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.LEFT_TO_UP]),
        glyph: new Set([]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'd')).toEqual([
      {
        top: new Set(),
        glyph: new Set([]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
  });

  it('sorts the children order correctly when there are redundant lines - complicated case', () => {
    // Graph:
    //  o e
    //  ├─┐─┐─┐
    //  │ │ │ o d
    //  │ │ ├─┘
    //  │ │ o c
    //  │ ├─┘
    //  │ o b
    //  ├─┘
    //  o a
    const commits = [
      newCommit('a', ['b', 'e']),
      newCommit('b', ['c', 'e']),
      newCommit('c', ['d', 'e']),
      newCommit('d', ['e']),
      newCommit('e', []),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(childrenOf(nodesMap, 'a')).toEqual(['e', 'b']);
    expect(coordinatesOf(nodesMap, commits)).toEqual([
      ['a', 0, 0],
      ['b', 1, 1],
      ['c', 2, 2],
      ['d', 3, 3],
      ['e', 0, 4],
    ]);
    expect(nodesMap.get('a')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('b')?.occupiedColumns).toEqual(2);
    expect(nodesMap.get('c')?.occupiedColumns).toEqual(3);
    expect(nodesMap.get('d')?.occupiedColumns).toEqual(4);
    expect(nodesMap.get('e')?.occupiedColumns).toEqual(1);

    expect(linesOf(nodesMap, 'a')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'b')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set([]),
        bottom: new Set([]),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'c')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'd')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.LEFT_TO_UP]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT, LineType.HORIZONTAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT, LineType.HORIZONTAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'e')).toEqual([
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
  });

  it('handles merge out rare scenario correctly', () => {
    // Graph:
    //  o d
    //  ├─┐
    //  │ │ o z
    //  │ ├─│
    //  │ o │ e
    //  ├─┴───┐
    //  │ o │ │ g
    //  │ ├─┘ │
    //  │ o f │
    //  ├─┘   │
    //  o c   │
    //  ├─┬───┘
    //  │ o h
    //  ├─┘
    //  o b
    //  │
    //  o a
    // The main focus of this test is to make sure that the line between
    // f an z is correctly drawn. It requires a merge out line that forks out
    // early. It is rare to come across this scenario, which is why the test
    // setup is so complicated.
    const commits = [
      newCommit('a', ['b']),
      newCommit('b', ['c', 'h']),
      newCommit('c', ['d', 'e', 'f']),
      newCommit('d', []),
      newCommit('e', ['d', 'z']),
      newCommit('f', ['g', 'z']),
      newCommit('g', []),
      newCommit('h', ['c', 'e']),
      newCommit('z', []),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(coordinatesOf(nodesMap, commits)).toEqual([
      ['a', 0, 0],
      ['b', 0, 1],
      ['c', 0, 3],
      ['d', 0, 8],
      ['e', 1, 6],
      ['f', 1, 4],
      ['g', 1, 5],
      ['h', 1, 2],
      ['z', 2, 7],
    ]);
    expect(nodesMap.get('a')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('b')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('c')?.occupiedColumns).toEqual(4);
    expect(nodesMap.get('d')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('e')?.occupiedColumns).toEqual(3);
    expect(nodesMap.get('f')?.occupiedColumns).toEqual(4);
    expect(nodesMap.get('g')?.occupiedColumns).toEqual(4);
    expect(nodesMap.get('h')?.occupiedColumns).toEqual(2);
    expect(nodesMap.get('z')?.occupiedColumns).toEqual(3);

    expect(linesOf(nodesMap, 'a')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'b')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'c')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'd')).toEqual([
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'e')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL, LineType.RIGHT_TO_UP]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'f')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'g')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP, LineType.LEFT_TO_UP]),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.VERTICAL, LineType.HORIZONTAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'h')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.LEFT_TO_UP]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.HORIZONTAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'z')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.LEFT_TO_UP]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
  });

  it('node placed as right as its leftmost child', () => {
    // Graph that **isn't** placed as right as its leftmost child:
    //  o e
    //  │ o d
    //  │ ├─┐
    //  │ o | c
    //  ├─┘ |
    //  │ o─┘ b
    //  ├─┘
    //  o a
    //
    // The expected graph:
    //  o e
    //  │ o d
    //  │ ├─┐
    //  │ o | c
    //  ├─┘ |
    //  │   o b
    //  ├───┘
    //  o a
    const commits = [
      newCommit('a', ['e', 'c', 'b']),
      newCommit('b', ['d']),
      newCommit('c', ['d']),
      newCommit('d', []),
      newCommit('e', []),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(coordinatesOf(nodesMap, commits)).toEqual([
      ['a', 0, 0],
      ['b', 2, 1],
      ['c', 1, 2],
      ['d', 1, 3],
      ['e', 0, 4],
    ]);
    // Skip testing the lines, because they are not the focus of this test.
  });

  it('handles merge commits correctly', () => {
    // Graph:
    //  o f
    //  ├─┐─┐─┐
    //  o │ │ │ b
    //  │ o │ │ c
    //  ├─┘ │ │
    //  │   o │ d
    //  ├───┘ │
    //  │     o e
    //  ├─────┘
    //  │ o g
    //  ├─┘
    //  o a
    const commits = [
      newCommit('a', ['b', 'c', 'd', 'e', 'g']),
      newCommit('b', ['f']),
      newCommit('c', ['f']),
      newCommit('d', ['f']),
      newCommit('e', ['f']),
      newCommit('f', []),
      newCommit('g', []),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(coordinatesOf(nodesMap, commits)).toEqual([
      ['a', 0, 0],
      ['b', 0, 5],
      ['c', 1, 4],
      ['d', 2, 3],
      ['e', 3, 2],
      ['f', 0, 6],
      ['g', 1, 1],
    ]);
    expect(nodesMap.get('a')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('b')?.occupiedColumns).toEqual(4);
    expect(nodesMap.get('c')?.occupiedColumns).toEqual(4);
    expect(nodesMap.get('d')?.occupiedColumns).toEqual(4);
    expect(nodesMap.get('e')?.occupiedColumns).toEqual(4);
    expect(nodesMap.get('f')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('g')?.occupiedColumns).toEqual(2);
  });

  it('handles very rare merge out scenario correctly', () => {
    // The key part of this test is to test the line from b to f.
    // It's a unique case where the x-coordinates of the parent, the line,
    // and the child are different.
    //
    // Graph:
    //  o i
    //  │ o h
    //  │ ├─┐─┐─┐
    //  │ o │ │ │ g
    //  ├─┘ │ o │ f
    //  │ ┌─┘─┘ │ Comment: There's an intersection of lines from e to f, e to h, and b to f.
    //  │ o │   │ e        that can't be drawn correctly using text.
    //  ├─┘ │   o d
    //  ├───│───┘
    //  │ o │ c
    //  │ ├─┘
    //  │ o b
    //  ├─┘
    //  o a
    const commits = [
      newCommit('a', ['i', 'g', 'e', 'd', 'b']),
      newCommit('b', ['c', 'f']),
      newCommit('c', []),
      newCommit('d', ['h']),
      newCommit('e', ['f', 'h']),
      newCommit('f', ['h']),
      newCommit('g', ['h']),
      newCommit('h', []),
      newCommit('i', []),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(coordinatesOf(nodesMap, commits)).toEqual([
      ['a', 0, 0],
      ['b', 1, 1],
      ['c', 1, 2],
      ['d', 4, 3],
      ['e', 1, 4],
      ['f', 3, 5],
      ['g', 1, 6],
      ['h', 1, 7],
      ['i', 0, 8],
    ]);
    expect(linesOf(nodesMap, 'a')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'b')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_RIGHT, LineType.VERTICAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'c')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.HORIZONTAL]),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.HORIZONTAL, LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.HORIZONTAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'd')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'e')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_RIGHT]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([
          LineType.UP_TO_RIGHT,
          LineType.RIGHT_TO_UP,
          LineType.HORIZONTAL,
        ]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'f')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.UP_TO_RIGHT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.RIGHT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'g')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.LEFT_TO_UP, LineType.VERTICAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.HORIZONTAL, LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.HORIZONTAL, LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set([LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'h')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'i')).toEqual([
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
  });

  it('multiple base commits', () => {
    // The expected graph:
    //  o b
    //  │
    //  o a
    //
    //  o e
    //  ├─┐
    //  o │ c
    //    o d
    const commits = [
      newCommit('a', ['b']),
      newCommit('b', []),
      newCommit('c', ['e']),
      newCommit('d', ['e']),
      newCommit('e', []),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(coordinatesOf(nodesMap, commits)).toEqual([
      ['a', 0, 3],
      ['b', 0, 4],
      ['c', 0, 1],
      ['d', 1, 0],
      ['e', 0, 2],
    ]);
    expect(nodesMap.get('a')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('b')?.occupiedColumns).toEqual(1);
    expect(nodesMap.get('c')?.occupiedColumns).toEqual(2);
    expect(nodesMap.get('d')?.occupiedColumns).toEqual(2);
    expect(nodesMap.get('e')?.occupiedColumns).toEqual(1);
    expect(linesOf(nodesMap, 'a')).toEqual([
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);
    expect(linesOf(nodesMap, 'b')).toEqual([
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'c')).toEqual([
      {
        top: new Set([LineType.VERTICAL, LineType.LEFT_TO_UP]),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.UP_TO_LEFT]),
        glyph: new Set([LineType.VERTICAL]),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
    expect(linesOf(nodesMap, 'd')).toEqual([
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set(),
      },
      {
        top: new Set([LineType.VERTICAL]),
        glyph: new Set(),
        bottom: new Set(),
      },
    ]);

    expect(linesOf(nodesMap, 'e')).toEqual([
      {
        top: new Set(),
        glyph: new Set(),
        bottom: new Set([LineType.VERTICAL]),
      },
    ]);
  });

  it('Redundant lines complicated case', () => {
    // This test case fails when fixRedundantLines is called before
    // optimizeChildrenOrder. fixRedundantLines is essential to the correctness of the graph.
    // optimizeChildrenOrder is just a nice-to-have that makes the graph
    // look better. So fixRedundantLines must be called after optimizeChildrenOrder.
    const commits = [
      newCommit('ls', []),
      newCommit('vx', []),
      newCommit('mq', ['nx', 'vr', 'vx']),
      newCommit('xq', ['ls']),
      newCommit('um', ['ls']),
      newCommit('vr', ['ww', 'um', 'ls', 'xq', 'wt']),
      newCommit('nx', ['vx', 'ls', 'ol']),
      newCommit('ol', ['ls']),
      newCommit('un', ['mq', 'ls']),
      newCommit('ww', ['ls']),
      newCommit('wt', ['ol']),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(coordinatesOf(nodesMap, commits)).toEqual([
      ['ls', 0, 9],
      ['vx', 0, 10],
      ['mq', 1, 1],
      ['xq', 7, 4],
      ['um', 5, 6],
      ['vr', 2, 2],
      ['nx', 2, 7],
      ['ol', 3, 8],
      ['un', 0, 0],
      ['ww', 6, 5],
      ['wt', 3, 3],
    ]);
  });
});

describe('insertAction', () => {
  it('calculates insertActions correctly', () => {
    //  o e
    //  ├─┬─┐
    //  o │ │ b
    //  │ o │ c
    //  ├─┘ o d
    //  ├───┘
    //  o a
    const commits = [
      newCommit('a', ['b', 'c', 'd']),
      newCommit('b', ['e']),
      newCommit('c', ['e']),
      newCommit('d', ['e']),
      newCommit('e', []),
    ];
    const nodesMap = createCommitNodes(commits);
    expect(insertActionsOf(nodesMap, 'a')).toEqual([
      {
        top: {
          from: 'a',
          to: undefined,
          insertNode: {x: 0, y: 0.5},
          insertHint: {x: 0, y: 0},
        },
        glyph: undefined,
        bottom: undefined,
      },
      {
        top: {
          from: 'a',
          to: 'd',
          insertNode: {x: 1, y: 0.5},
          insertHint: {x: 2, y: 0.5},
        },
        glyph: undefined,
        bottom: undefined,
      },
      {
        top: {
          from: 'a',
          to: 'd',
          insertNode: {x: 1, y: 0.5},
          insertHint: {x: 2, y: 0.5},
        },
        glyph: undefined,
        bottom: undefined,
      },
    ]);
    expect(insertActionsOf(nodesMap, 'b')).toEqual([
      {
        top: {
          from: 'b',
          to: 'e',
          insertNode: {x: 0, y: 3.5},
          insertHint: {x: 0, y: 3.5},
        },
        glyph: undefined,
        bottom: {
          from: 'a',
          to: 'b',
          insertNode: {x: 0, y: 2},
          insertHint: {x: 0, y: 2},
        },
      },
      {
        top: {
          from: 'c',
          to: 'e',
          insertNode: {x: 1, y: 3},
          insertHint: {x: 1, y: 3},
        },
        glyph: {
          from: 'c',
          to: 'e',
          insertNode: {x: 1, y: 3},
          insertHint: {x: 1, y: 3},
        },
        bottom: {
          from: 'c',
          to: 'e',
          insertNode: {x: 1, y: 3},
          insertHint: {x: 1, y: 3},
        },
      },
      {
        top: {
          from: 'd',
          to: 'e',
          insertNode: {x: 2, y: 3},
          insertHint: {x: 2, y: 3},
        },
        glyph: {
          from: 'd',
          to: 'e',
          insertNode: {x: 2, y: 3},
          insertHint: {x: 2, y: 3},
        },
        bottom: {
          from: 'd',
          to: 'e',
          insertNode: {x: 2, y: 3},
          insertHint: {x: 2, y: 3},
        },
      },
    ]);
    expect(insertActionsOf(nodesMap, 'c')).toEqual([
      {
        top: {
          from: 'a',
          to: 'b',
          insertNode: {x: 0, y: 2},
          insertHint: {x: 0, y: 2},
        },
        glyph: {
          from: 'a',
          to: 'b',
          insertNode: {x: 0, y: 2},
          insertHint: {x: 0, y: 2},
        },
        bottom: {
          from: 'a',
          to: 'b',
          insertNode: {x: 0, y: 2},
          insertHint: {x: 0, y: 2},
        },
      },
      {
        top: {
          from: 'c',
          to: 'e',
          insertNode: {x: 1, y: 3},
          insertHint: {x: 1, y: 3},
        },
        glyph: undefined,
        bottom: {
          from: 'a',
          to: 'c',
          insertNode: {x: 0.5, y: 1.5},
          insertHint: {x: 1, y: 1.5},
        },
      },
      {
        top: {
          from: 'd',
          to: 'e',
          insertNode: {x: 2, y: 3},
          insertHint: {x: 2, y: 3},
        },
        glyph: {
          from: 'd',
          to: 'e',
          insertNode: {x: 2, y: 3},
          insertHint: {x: 2, y: 3},
        },
        bottom: {
          from: 'd',
          to: 'e',
          insertNode: {x: 2, y: 3},
          insertHint: {x: 2, y: 3},
        },
      },
    ]);
    expect(insertActionsOf(nodesMap, 'd')).toEqual([
      {
        top: {
          from: 'a',
          to: 'b',
          insertNode: {x: 0, y: 2},
          insertHint: {x: 0, y: 2},
        },
        glyph: {
          from: 'a',
          to: 'b',
          insertNode: {x: 0, y: 2},
          insertHint: {x: 0, y: 2},
        },
        bottom: {
          from: 'a',
          to: 'b',
          insertNode: {x: 0, y: 2},
          insertHint: {x: 0, y: 2},
        },
      },
      {
        top: {
          from: 'a',
          to: 'c',
          insertNode: {x: 0.5, y: 1.5},
          insertHint: {x: 1, y: 1.5},
        },
        glyph: undefined,
        bottom: {
          from: 'a',
          to: 'd',
          insertNode: {x: 1, y: 0.5},
          insertHint: {x: 2, y: 0.5},
        },
      },
      {
        top: {
          from: 'd',
          to: 'e',
          insertNode: {x: 2, y: 3},
          insertHint: {x: 2, y: 3},
        },
        glyph: undefined,
        bottom: {
          from: 'a',
          to: 'd',
          insertNode: {x: 1, y: 0.5},
          insertHint: {x: 2, y: 0.5},
        },
      },
    ]);
    expect(insertActionsOf(nodesMap, 'e')).toEqual([
      {
        top: undefined,
        glyph: undefined,
        bottom: {
          from: undefined,
          to: 'e',
          insertNode: {x: 0, y: 3.5},
          insertHint: {x: 0, y: 4},
        },
      },
    ]);
  });
});
