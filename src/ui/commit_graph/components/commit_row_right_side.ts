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
import {ifDefined} from 'lit/directives/if-defined';
import type {ExtensionShape} from '../api/extension_shape';
import type {CommitGraphState, CommitNode} from '../api/types';
import {MERGE_TILE_HEIGHT, TILE_HEIGHT} from './constants';

import './commit_row_title';
import './drag_and_drop_publisher';

@customElement('jj-commit-row-right-side')
class JjCommitRowRightSide extends LitElement {
  static override get styles() {
    return css`
      :host {
        display: flex;
        position: relative;
        flex-direction: column;
      }
      .commit-row-right-side {
        display: flex;
        padding: 0px;
        width: calc(100% - 3px);
        height: 100%;
        flex-direction: row;
      }
      .button-group-wrapper {
        height: ${TILE_HEIGHT + 2 * MERGE_TILE_HEIGHT}px;
      }
      .button-group {
        display: flex;
        flex-grow: 1;
        flex-direction: row;
        height: 100%;
        gap: 1px;
        background-color: transparent;
        align-items: center;
      }
      .button-group[shouldHide] {
        display: none;
      }
      vscode-icon[isActivelySelected] {
        color: var(--vscode-list-activeSelectionForeground);
      }
    `;
  }

  @property({attribute: false}) isDraggable!: boolean;
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) node!: CommitNode;
  @property({attribute: false}) isHovered!: boolean;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) openContextMenu!: (event: MouseEvent) => void;

  override render() {
    return html`
      <div class="commit-row-right-side" draggable="${this.isDraggable}">
        <jj-commit-row-title
          .extensionApi=${this.extensionApi}
          .state=${this.state}
          .node=${this.node}
        >
        </jj-commit-row-title>
        <div class="button-group-wrapper">${this.renderIconButtons()}</div>
      </div>
    `;
  }

  private renderIconButtons() {
    const buttons = (this.node.iconButtons ?? []).map((button) => {
      return html`
        <vscode-icon
          name=${button.icon}
          title=${ifDefined(button.command.tooltip)}
          ?isActivelySelected=${this.node.isMultiSelected}
          action-icon
          @click=${(event: MouseEvent) => {
            event.stopPropagation();
            void this.extensionApi.$executeCommand(
              this.state.repoName,
              button.command.command,
              button.command.arguments,
            );
          }}
        ></vscode-icon>
      `;
    });
    const contextMenuButton = html`
      <vscode-icon
        name="kebab-vertical"
        title="More"
        ?isActivelySelected=${this.node.isMultiSelected}
        action-icon
        @click=${(event: MouseEvent) => {
          this.openContextMenu(event);
        }}
      ></vscode-icon>
    `;
    return html`
      <div
        class="button-group"
        ?shouldHide=${!this.isHovered && !this.state.options.alwaysShowActions}
      >
        ${buttons}
        ${this.state.options.showContextMenuIcon ? contextMenuButton : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-commit-row-right-side': JjCommitRowRightSide;
  }
}
