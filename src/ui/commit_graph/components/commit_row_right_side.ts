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

import {parseCodicon} from '../utils/codicon';
import './commit_row_title';
import './commit_row_bookmarks';
import './drag_and_drop_publisher';
import './commit_row_display_id';

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
        gap: 3px;
      }
      .commit-row-right-side-inner {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        width: 100%;
      }
      .flex {
        display: flex;
        gap: 3px;
      }
      .button-group {
        display: flex;
        flex-grow: 1;
        flex-direction: row;
        height: 100%;
        gap: 1px;
        background-color: transparent;
        align-items: center;
        margin: auto;
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
  @property({attribute: false}) nodes!: CommitNode[];
  @property({attribute: false}) isHovered!: boolean;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) openContextMenu!: (event: MouseEvent) => void;

  override render() {
    if (this.state.options.twoLineMode) {
      return this.renderTwoLineMode();
    } else {
      return this.renderOneLineMode();
    }
  }

  private renderOneLineMode() {
    return html`
      <div class="commit-row-right-side" draggable="${this.isDraggable}">
        <jj-commit-row-bookmarks
          .node=${this.node}
          .extensionApi=${this.extensionApi}
          .state=${this.state}
        >
        </jj-commit-row-bookmarks>
        <jj-commit-row-title
          .extensionApi=${this.extensionApi}
          .state=${this.state}
          .node=${this.node}
        >
        </jj-commit-row-title>
        ${this.renderIconButtons()}
      </div>
    `;
  }

  private renderTwoLineMode() {
    return html`
      <div class="commit-row-right-side" draggable="${this.isDraggable}">
        <div class="commit-row-right-side-inner">
          <div class="flex">
            <jj-commit-row-display-id
              .extensionApi=${this.extensionApi}
              .state=${this.state}
              .node=${this.node}
              .nodes=${this.nodes}
            >
            </jj-commit-row-display-id>
            <jj-commit-row-bookmarks
              .node=${this.node}
              .extensionApi=${this.extensionApi}
              .state=${this.state}
            >
            </jj-commit-row-bookmarks>
          </div>
          <jj-commit-row-title
            .extensionApi=${this.extensionApi}
            .state=${this.state}
            .node=${this.node}
          >
          </jj-commit-row-title>
        </div>
        ${this.renderIconButtons()}
      </div>
    `;
  }

  private renderIconButtons() {
    const buttons = (this.node.iconButtons ?? []).map((button) => {
      const {name, spin} = parseCodicon(button.icon);
      return html`
        <vscode-icon
          name=${name}
          ?spin=${spin}
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
