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
import {styleMap} from 'lit/directives/style-map';

@customElement('jj-codicon')
class JjCodicon extends LitElement {
  static override styles = [
    css`
      :host {
        width: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .codicon {
        color: var(--vscode-foreground);
      }
    `,
  ];

  // Required. The codicon to display.
  @property({attribute: false}) codicon!: string;

  // Optional. If set, the codicon will be rendered with the given color.
  @property({attribute: false}) color?: string;

  override render() {
    if (this.codicon === 'codicon-checkout') {
      return html`<jj-edit-codicon></jj-edit-codicon>`;
    }
    let codicon = this.codicon;
    if (codicon.startsWith('codicon-')) {
      codicon = codicon.slice('codicon-'.length);
    }
    const styles = styleMap({
      color: this.color,
    });
    return html`<vscode-icon name="${codicon}" style=${styles}></vscode-icon>`;
  }
}

@customElement('jj-edit-codicon')
class JjEditCodicon extends LitElement {
  override render() {
    return html`
      <svg
        viewBox="0 -1 16 15"
        width="16"
        height="16"
        stroke="currentColor"
        fill="currentColor"
      >
        <line x1="3.5" y1="6.4" x2="3.5" y2="1" stroke-width="1"></line>
        <line x1="3.5" y1="10.1" x2="3.5" y2="15" stroke-width="1"></line>
        <circle cx="3.5" cy="8.5" r="2.1" stroke-width="1" fill="none"></circle>
        <path
          d="M13.23 1h-1.46L3.52 9.25l-.16.22L1 13.59 2.41 15l4.12-2.36.22-.16L15 4.23V2.77L13.23 1zM2.41 13.59l1.51-3 1.45 1.45-2.96 1.55zm3.83-2.06L4.47 9.76l8-8 1.77 1.77-8 8z"
          stroke="none"
          transform="scale(0.7) translate(8, 0)"
        ></path>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-codicon': JjCodicon;
    'jj-edit-codicon': JjEditCodicon;
  }
}
