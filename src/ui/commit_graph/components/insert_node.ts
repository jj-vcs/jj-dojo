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

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators';
import {svgCircle} from './glyphs';

@customElement('jj-insert-node')
class JjInsertNode extends LitElement {
  static override get styles() {
    return css`
      :host {
        pointer-events: none;
      }
      svg {
        position: absolute;
        z-index: 1;
        top: 0;
        left: 0;
        overflow: visible;
        max-width: 10px;
        max-height: 10px;
      }
    `;
  }

  @property({attribute: false}) skewX!: number;
  @property({attribute: false}) skewY!: number;

  override render() {
    return html`
      <svg>
        <g transform="translate(${this.skewX}, ${-this.skewY})">
          ${svgCircle('var(--vscode-button-background)', {
            r: 5,
          })}
        </g>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-insert-node': JjInsertNode;
  }
}
