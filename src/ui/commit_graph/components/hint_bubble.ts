/**
 * @license
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
  .hint-bubble {
    pointer-events: none;
    filter: drop-shadow(0px 1px 1px rgba(0, 0, 0, 1));
  }
  .hint-bubble path {
    stroke: var(--vscode-button-background);
    fill: transparent;
    stroke-width: 2px;
  }
  .hint-bubble rect {
    fill: var(--vscode-button-background);
  }
  .hint-bubble text {
    text-anchor: middle;
    dominant-baseline: middle;
    fill: var(--vscode-button-foreground);
  }
`;
