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

import {css} from 'lit';

/**
 * Styles for all hint bubbles.
 */
export const HINT_BUBBLE_STYLES = css`
  :host {
    pointer-events: none;
  }
  svg {
    position: absolute;
    z-index: 10;
    top: 0;
    left: 0;
    overflow: visible;
    filter: drop-shadow(0px 1px 1px rgba(0, 0, 0, 1));
    /**
     * We must define a max width and height for this element. Otherwise
     * when dragging and dropping, the svg can glitch. It glitches because
     *  - when dragging and scrolling to the very bottom of the graph
     *  - rebase hint appears for the bottommost commit
     *  - the svg's large height causes the graph to grow in height
     *  - this causes the mouse position to leave the commit row
     *  - which causes the rebase hint to disappear
     *  - which causes the graph shrink back
     *  - repeat back to the first point.
     *
     * To avoid this, we set a max width and height. It doesn't matter
     * what the width and height are as long as they are small enough.
     */
    max-width: 10px;
    max-height: 10px;
  }
  path {
    stroke: var(--vscode-button-background);
    fill: transparent;
    stroke-width: 2px;
  }
  rect {
    fill: var(--vscode-button-background);
  }
  text {
    text-anchor: middle;
    dominant-baseline: middle;
    fill: var(--vscode-button-foreground);
  }
`;
