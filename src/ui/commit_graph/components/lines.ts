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

import {checkExhaustive} from '../utils/check';
import {svg} from 'lit';
import {InsertAction, Line, LineType} from '../api/types';
import {STROKE_WIDTH} from './constants';
import {isNoopInsert, Target} from './drag_and_drop_state';

/**
 * When rendering the commit graph in VSCode, there is an unknown tiny gap
 * (< 0.5 px) in between the tiles. To avoid this, we add a small offset to
 * extend the lines and cover the gap.
 *
 * Note that this problem only happens in VSCode. When the graph is rendered
 * in the browser, there is no gap.
 */
const VSCODE_OFFSET = 0.5;

interface SvgDimensions {
  tileWidth: number;
  tileHeight: number;
  color?: string;
}

/**
 * Returns the color and priority of a line.
 */
export function getLineColor(data: {
  line: Line;
  dragged: Target | undefined;
  hovered: Target | undefined;
}): {
  // The color of the line.
  color: string;
  // The priority of the line. Lines with higher priority will be rendered on
  // top of lines with lower priority.
  priority: number;
  // The width of the line.
  strokeWidth: number;
} {
  const {line, dragged, hovered} = data;
  let insert: InsertAction | undefined;
  if (hovered?.type === 'insert') {
    insert = hovered.data;
  }
  if (!isNoopInsert(dragged, hovered) && matches(line, insert)) {
    return {
      color: 'var(--vscode-button-background)',
      priority: 2,
      strokeWidth: 2.5,
    };
  }

  if (
    dragged?.type !== 'commit' &&
    line.child.node.isWorkingCopyCommitAncestor
  ) {
    return {
      color: 'var(--vscode-foreground)',
      priority: 1,
      strokeWidth: STROKE_WIDTH,
    };
  } else {
    return {
      color: 'var(--inactiveLineColor)',
      priority: 0,
      strokeWidth: STROKE_WIDTH,
    };
  }
}

function matches(line: Line, insert: InsertAction | undefined): boolean {
  if (insert === undefined) {
    return false;
  }
  if (insert.from === undefined) {
    return line.child.node === insert.to;
  }
  if (insert.to === undefined) {
    return line.parent === insert.from;
  }
  return line.child.node === insert.to && line.parent === insert.from;
}

/**
 * Returns an SVG element for a given line.
 */
export function getSvgLine(
  line: Line,
  dragged: Target | undefined,
  hovered: Target | undefined,
  options: SvgDimensions,
) {
  const {color, priority, strokeWidth} = getLineColor({
    line,
    dragged,
    hovered,
  });
  return svg`
    <svg viewBox="0 0 ${options.tileWidth} ${options.tileHeight}" style="z-index: ${priority};">
       <g
      stroke="${color}"
      fill="none"
      stroke-width="${strokeWidth}"
      style="pointer-events: none"
    > ${getSvgLineInternal(line, options)} </g>
    </svg>
  `;
}

function getSvgLineInternal(line: Line, dimensions: SvgDimensions) {
  switch (line.type) {
    case LineType.VERTICAL:
      return verticalLine(dimensions);
    case LineType.HORIZONTAL:
      return horizontalLine(dimensions);
    case LineType.UP_TO_RIGHT:
      return upToRight(dimensions);
    case LineType.UP_TO_LEFT:
      return upToLeft(dimensions);
    case LineType.RIGHT_TO_UP:
      return rightToUp(dimensions);
    case LineType.LEFT_TO_UP:
      return leftToUp(dimensions);
    default:
      checkExhaustive(line.type);
  }
}

function verticalLine(dimensions: SvgDimensions) {
  return svg`
    <path d="
      M ${dimensions.tileWidth / 2} -${VSCODE_OFFSET}
      L ${dimensions.tileWidth / 2} ${dimensions.tileHeight + VSCODE_OFFSET}"
    ></path>
  `;
}

function horizontalLine(dimensions: SvgDimensions) {
  return svg`
    <path d="
      M -${VSCODE_OFFSET} 0
      L ${dimensions.tileWidth + VSCODE_OFFSET} 0"
    ></path>
  `;
}

/**
 * See documentation for `LineType` for the shape of this line.
 *
 * This draws a Bezier curve. See
 *  https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths#b%C3%A9zier_curves
 *  https://svg-tutorial.com/editor/quadratic-bezier
 */
export function upToRight(dimensions: SvgDimensions) {
  return svg`
    <path d="
      M ${dimensions.tileWidth / 2} ${dimensions.tileHeight}
      Q ${dimensions.tileWidth / 2} 0 ${dimensions.tileWidth + VSCODE_OFFSET} 0"
    ></path>
  `;
}

function rightToUp(dimensions: SvgDimensions) {
  return svg`
    <g transform="translate(0, -${dimensions.tileHeight})">
      <path d="
        M -${VSCODE_OFFSET} ${dimensions.tileHeight}
        Q ${dimensions.tileWidth / 2} ${dimensions.tileHeight} ${dimensions.tileWidth / 2} 0"
      ></path>
    </g>
  `;
}

function upToLeft(dimensions: SvgDimensions) {
  return svg`
    <path d="
      M ${-VSCODE_OFFSET} 0
      Q ${dimensions.tileWidth / 2} 0 ${dimensions.tileWidth / 2} ${dimensions.tileHeight}"
    ></path>
  `;
}

function leftToUp(dimensions: SvgDimensions) {
  return svg`
    <g transform="translate(0, ${-dimensions.tileHeight})">
      <path d="
        M ${dimensions.tileWidth / 2} 0
        Q ${dimensions.tileWidth / 2} ${dimensions.tileHeight} ${dimensions.tileWidth + VSCODE_OFFSET} ${dimensions.tileHeight}"
      ></path>
    </g>
  `;
}
