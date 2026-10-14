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
import {TILE_HEIGHT, TILE_WIDTH} from './constants';
import {upToRight} from './lines';

const HINT_BUBBLE_WIDTH = 85;
const HINT_BUBBLE_HEIGHT = 20;

/**
 * Returns an SVG group for a rebase hint bubble.
 */
export function svgRebaseHint() {
  return svg`
    <g class="hint-bubble">
      <g transform="translate(0, ${-TILE_HEIGHT / 2})">
        ${upToRight({
          tileWidth: TILE_WIDTH,
          tileHeight: TILE_HEIGHT / 2,
        })}
      </g>
      <g transform="translate(0 ${-TILE_HEIGHT})">
        <rect
          x="${TILE_WIDTH}"
          y="${TILE_HEIGHT / 2 - HINT_BUBBLE_HEIGHT / 2}"
          width="${HINT_BUBBLE_WIDTH}"
          height="${HINT_BUBBLE_HEIGHT}"
          rx="5"
        ></rect>
        <text
          x="${TILE_WIDTH + HINT_BUBBLE_WIDTH / 2}"
          y="${TILE_HEIGHT / 2}"
        >
          Rebase here
        </text>
      </g>
    </g>
  `;
}
