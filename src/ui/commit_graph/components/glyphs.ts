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

import {svg} from 'lit';
import {
  CIRCLE_RADIUS,
  STROKE_WIDTH,
  TILE_HEIGHT,
  TILE_WIDTH,
} from './constants';

/**
 * A circle icon, typically used for unsubmitted commits.
 */
export function svgCircle(
  color: string,
  dimensions?: {
    r: number;
  },
) {
  const r = dimensions?.r ?? CIRCLE_RADIUS;
  return svg`
    <circle
      cx="${TILE_WIDTH / 2}"
      cy="${TILE_HEIGHT / 2}"
      r="${r}"
      fill="${color}"
    ></circle>
  `;
}

// The idea of sqrt is to make the diamond icon have the same area as circles.
const DIAMOND_SIDE = CIRCLE_RADIUS * Math.sqrt(3.14);

/**
 * A diamond icon, typically used for submitted commits.
 */
export function svgDiamond(color: string) {
  return svg`
    <g transform="translate(${TILE_WIDTH / 2}, ${TILE_HEIGHT / 2})">
      <rect
        x="${-DIAMOND_SIDE / 2}"
        y="${-DIAMOND_SIDE / 2}"
        width="${DIAMOND_SIDE}"
        height="${DIAMOND_SIDE}"
        fill="none"
        stroke="${color}"
        stroke-width="${STROKE_WIDTH}"
        transform="rotate(45)"
      ></rect>
    </g>
  `;
}

const CROSS_WIDTH = Math.min(TILE_WIDTH, TILE_HEIGHT) * 0.5;
const HALF_CROSS_WIDTH = CROSS_WIDTH / 2;

/**
 * A cross icon, typically used for conflicted commits.
 */
export function svgCross(color: string) {
  return svg`
    <g transform="translate(${TILE_WIDTH / 2}, ${TILE_HEIGHT / 2})" stroke="${color}" stroke-width="${STROKE_WIDTH}">
      <line x1="${-HALF_CROSS_WIDTH}" y1="${-HALF_CROSS_WIDTH}" x2="${HALF_CROSS_WIDTH}" y2="${HALF_CROSS_WIDTH}" />
      <line x1="${-HALF_CROSS_WIDTH}" y1="${HALF_CROSS_WIDTH}" x2="${HALF_CROSS_WIDTH}" y2="${-HALF_CROSS_WIDTH}" />
    </g>
  `;
}

/**
 * An @ symbol, typically used for the working copy commit.
 */
export function svgAtSymbol(color: string) {
  return svg`
    <text
      x = "${TILE_WIDTH / 2}"
      y = "${TILE_HEIGHT / 2}"
      style="
        font: 16px sans-serif;
        text-anchor: middle;
        dominant-baseline: middle;
        alignment-baseline: central;
        fill: ${color}
      "
    > @ </text>
  `;
}
