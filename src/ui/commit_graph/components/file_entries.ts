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
import type {FileEntry} from '../api/types';
import './file_icon';

/**
 * Component that displays file entries with their corresponding file icon theme icons.
 */
@customElement('jj-file-entries')
export class JjFileEntries extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .file-entries-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 12px;
      margin: 8px;
      background-color: var(
        --vscode-sideBar-background,
        rgba(128, 128, 128, 0.05)
      );
      border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.2));
      border-radius: 4px;
      font-family: var(--vscode-font-family);
    }
    .file-entries-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .file-entry-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 6px;
      border-radius: 3px;
      font-size: 13px;
      color: var(--vscode-foreground);
    }
    .file-entry-item:hover {
      background-color: var(
        --vscode-list-hoverBackground,
        rgba(128, 128, 128, 0.1)
      );
    }
    .file-entry-item .file-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;

  @property({attribute: false})
  files: readonly FileEntry[] = [];

  override render() {
    return html`
      <div class="file-entries-list">
        <div class="file-entries-header">Files</div>
        ${this.files.map(
          (file) => html`
            <div class="file-entry-item">
              <jj-file-icon .file=${file}></jj-file-icon>
              <span class="file-name">${file.filePath}</span>
            </div>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-file-entries': JjFileEntries;
  }
}
