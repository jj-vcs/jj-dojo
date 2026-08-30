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

import {css, html} from 'lit';
import {customElement, property, state} from 'lit/decorators';
import type {ExtensionShape} from '../api/extension_shape';
import {RenderMode, type CommitGraphState, type CommitNode} from '../api/types';
import {openContextMenu} from '../components/context_menu_provider';
import {JjCommitRowDisplayId} from './commit_row_display_id';
import {JjCommitRowLeftSide} from './commit_row_left_side';
import {isDraggable} from './drag_and_drop_publisher';
import {createCommitTarget} from './drag_and_drop_state';
import {JjDragAndDropSubscriber} from './drag_and_drop_subscriber';

import './commit_row_display_id';
import './commit_row_left_side';
import './commit_row_right_side';
import './drag_and_drop_publisher';

@customElement('jj-commit-row')
class JjCommitRow extends JjDragAndDropSubscriber {
  static override styles = css`
    .commit-row {
      display: flex;
      flex-direction: row;
      padding: 0px;
      padding-left: 7px;
      padding-right: 5px;
    }
    .commit-row:hover {
      background-color: var(--vscode-list-hoverBackground);
      cursor: pointer;
    }
    .commit-row[isInactivelySelected] {
      background-color: var(--vscode-list-inactiveSelectionBackground);
    }
    .commit-row[isActivelySelected] {
      background-color: var(--jj-activeCommitRow-background);
      color: var(--jj-activeCommitRow-foreground);
    }
    .commit-row[isDragDestination] {
      background-color: var(--vscode-list-dropBackground);
      color: var(--vscode-foreground);
    }
    jj-commit-row-left-side {
      position: absolute;
    }
    jj-drag-and-drop-publisher {
      flex-grow: 1;
      overflow: hidden;
    }
  `;

  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) node!: CommitNode;
  @property({attribute: false}) nodes!: CommitNode[];

  @state() isHovered = false;

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('mouseenter', () => (this.isHovered = true));
    this.addEventListener('mouseleave', () => (this.isHovered = false));
  }

  override render() {
    const displayIdWidth = this.shouldRenderDisplayId()
      ? JjCommitRowDisplayId.getWidth(this.nodes, this.state.options)
      : 0;
    const graphWidth = JjCommitRowLeftSide.getWidth(this.node);

    const target = createCommitTarget(this.node);
    return html`
      <div
        class="commit-row"
        title=${this.node.fullDescription}
        ?isInactivelySelected=${this.node.active ?? false}
        ?isActivelySelected=${this.node.isMultiSelected}
        ?isDragDestination=${this.isDragDestination}
        @click=${(event: MouseEvent) => {
          if (event.defaultPrevented) {
            // This is a workaround for the fact that vs code webviews don't
            // allow calling event.stopPropagation on the click event.
            // See commit_row_chip.ts for more details.
            return;
          }
          void this.extensionApi.$onClick(
            this.state.repoName,
            this.node.hash,
            /*metaKey=*/ event.metaKey || event.ctrlKey,
            /*shiftKey=*/ event.shiftKey,
          );
        }}
        @dblclick=${(event: MouseEvent) => {
          if (event.metaKey || event.ctrlKey) {
            return;
          }
          if (this.node.dblClick) {
            void this.extensionApi.$executeCommand(
              this.state.repoName,
              this.node.dblClick.command,
              this.node.dblClick.arguments,
            );
          }
        }}
        @contextmenu=${async (event: MouseEvent) => {
          await this.openContextMenu(event);
        }}
      >
        ${this.renderDisplayId()}
        <jj-commit-row-left-side
          .state=${this.state}
          .extensionApi=${this.extensionApi}
          .node=${this.node}
          style="margin-left: ${displayIdWidth}px"
        >
        </jj-commit-row-left-side>
        <jj-drag-and-drop-publisher
          .publishedTarget=${target}
          .extensionApi=${this.extensionApi}
          .state=${this.state}
          class="drag-and-drop-publisher"
        >
          <jj-commit-row-right-side
            class="commit-row-right-side"
            .isDraggable=${isDraggable(target, this.state)}
            .extensionApi=${this.extensionApi}
            .node=${this.node}
            .nodes=${this.nodes}
            .isHovered=${this.isHovered}
            .state=${this.state}
            .openContextMenu=${this.openContextMenu}
            style="margin-left: ${graphWidth}px"
          >
          </jj-commit-row-right-side>
        </jj-drag-and-drop-publisher>
      </div>
    `;
  }

  private async openContextMenu(event: MouseEvent) {
    // Beware, this informCallContextMenuWillOpen cannot be removed even
    // though it's no longer used by any callers.
    // When it is removed, sometimes the context menu will not show up.
    // It's unclear whether this is a bug in our context_menu_provider.ts,
    // or a bug in vscode's context menu implementation, or maybe something
    // else entirely.
    await this.extensionApi.$informContextMenuWillOpen(
      this.state.repoName,
      this.node.hash,
    );
    if (this.state.multiSelectionMode && this.node.isMultiSelected) {
      openContextMenu({
        dataVscodeContext:
          '{"origin": "commitRowMultiSelected", "preventDefaultContextMenuItems": true}',
        clientX: event.clientX,
        clientY: event.clientY,
      });
    } else {
      openContextMenu({
        dataVscodeContext: JSON.stringify({
          ...(this.node.vscodeContext ?? {}),
          origin: 'commitRow',
          preventDefaultContextMenuItems: true,
        }),
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }
    event.preventDefault();
  }

  private renderDisplayId() {
    if (this.shouldRenderDisplayId()) {
      return html`
        <jj-commit-row-display-id
          .extensionApi=${this.extensionApi}
          .state=${this.state}
          .node=${this.node}
          .nodes=${this.nodes}
        >
        </jj-commit-row-display-id>
      `;
    }
    return html``;
  }

  private shouldRenderDisplayId() {
    return (
      this.state.options.showChangeId &&
      this.state.options.renderMode === RenderMode.ONE_LINE
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-commit-row': JjCommitRow;
  }
}
