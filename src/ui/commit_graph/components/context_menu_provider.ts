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

import {LitElement, html} from 'lit';
import {customElement} from 'lit/decorators';

/**
 * Opens the context menu at the given coordinates.
 */
export function openContextMenu(options: {
  dataVscodeContext: string;
  clientX: number;
  clientY: number;
}) {
  const target = document.getElementById('jj-context-menu-provider');
  if (target === null) {
    return;
  }
  target.setAttribute('data-vscode-context', options.dataVscodeContext);
  target.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      clientX: options.clientX,
      clientY: options.clientY,
    }),
  );
}

@customElement('jj-context-menu-provider')
class JjContextMenuProvider extends LitElement {
  override render() {
    return html`
      <button id="jj-context-menu-provider" style="display: none"></button>
    `;
  }

  override createRenderRoot() {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-context-menu-provider': JjContextMenuProvider;
  }
}
