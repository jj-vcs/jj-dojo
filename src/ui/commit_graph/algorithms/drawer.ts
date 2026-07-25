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

import {
  CommitChildNode,
  CommitNode,
  Line,
  LineType,
  TileGroup,
} from '../api/types';

/**
 * Returns an empty tile group.
 */
export function getEmptyTileGroup(): TileGroup {
  return {
    top: {lines: []},
    glyph: {lines: []},
    bottom: {lines: []},
  };
}

function getOrInsert(node: CommitNode, x: number) {
  for (let i = node.tileGroups.length; i <= x; ++i) {
    node.tileGroups.push(getEmptyTileGroup());
  }
  return node.tileGroups[x];
}

function createLine(
  type: LineType,
  base: {parent: CommitNode; child: CommitChildNode},
): Line {
  return {
    ...base,
    type,
  };
}

enum TileType {
  BOTTOM = 0,
  GLYPH = 1,
  TOP = 2,
}

/**
 * Provides helper methods to draw lines
 */
export class TileDrawer {
  constructor(
    private readonly sortedNodes: CommitNode[],
    private readonly base: {parent: CommitNode; child: CommitChildNode},
    private x: number,
    private y: number,
    private tile: TileType = TileType.GLYPH,
  ) {}

  up(repeat: number) {
    const verticalLine = createLine(LineType.VERTICAL, this.base);
    for (let i = 0; i < repeat; ++i) {
      this.moveUp();
      this.draw(verticalLine);
    }
  }

  left(repeat: number) {
    const horizontalLine = createLine(LineType.HORIZONTAL, this.base);
    for (let i = 0; i < repeat; ++i) {
      this.moveLeft();
      this.draw(horizontalLine);
    }
  }

  right(repeat: number) {
    const horizontalLine = createLine(LineType.HORIZONTAL, this.base);
    for (let i = 0; i < repeat; ++i) {
      this.moveRight();
      this.draw(horizontalLine);
    }
  }

  upToRight() {
    this.moveUp();
    this.draw(createLine(LineType.UP_TO_RIGHT, this.base));
  }

  upToLeft() {
    this.moveUp();
    this.draw(createLine(LineType.UP_TO_LEFT, this.base));
  }

  rightToUp() {
    this.moveRight();
    this.draw(createLine(LineType.RIGHT_TO_UP, this.base));
  }

  leftToUp() {
    this.moveLeft();
    this.draw(createLine(LineType.LEFT_TO_UP, this.base));
  }

  moveUp() {
    if (++this.tile === 3) {
      this.y += 1;
      this.tile = 0;
    }
  }

  private moveLeft() {
    this.x -= 1;
  }

  private moveRight() {
    this.x += 1;
  }

  private draw(line: Line) {
    const tileGroup = getOrInsert(this.sortedNodes[this.y], this.x);
    if (this.tile === TileType.BOTTOM) {
      tileGroup.bottom.lines.push(line);
    } else if (this.tile === TileType.GLYPH) {
      tileGroup.glyph.lines.push(line);
    } else {
      tileGroup.top.lines.push(line);
    }
  }
}
