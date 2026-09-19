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

import {css, html, TemplateResult} from 'lit';
import {customElement, property, state} from 'lit/decorators';
import type {ExtensionShape} from '../api/extension_shape';
import type {CommitGraphState, CommitNode, TileGroup} from '../api/types';
import {RenderMode, CommitRowType} from '../api/types';
import {openContextMenu} from '../components/context_menu_provider';
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
    :host(:hover) {
      display: block;
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
    if (this.state.options.renderMode === RenderMode.TWO_LINE) {
      return html` ${this.renderCommitRow(
        this.renderTwoLineModeFirstLine(),
      )}${this.renderCommitRow(this.renderTwoLineModeSecondLine())}`;
    }
    return this.renderCommitRow(this.renderOneLineMode());
  }

  private renderCommitRow(innerElements: TemplateResult) {
    return html`<div
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
      ${innerElements}
    </div>`;
  }

  private renderOneLineMode() {
    const type = CommitRowType.ONE_LINE_MODE;
    return html`
      ${this.renderDisplayId()}
      ${this.renderCommitRowLeftSide({type})}${this.renderCommitRowRightSide({
        type,
      })}
    `;
  }

  private renderTwoLineModeFirstLine() {
    const type = CommitRowType.FIRST_IN_TWO_LINE_MODE;
    return html`
      ${this.renderCommitRowLeftSide({type})} ${this.renderDisplayId()}
      <!-- Insert a 3px gap. The display id is too close to the chips in two-line mode.
       It's not a problem in one-line mode since the graph naturally has some white space
       surrounding the lines.
      -->
      ${this.insertMargin(3)} ${this.renderCommitRowRightSide({type})}
    `;
  }

  private renderTwoLineModeSecondLine() {
    const type = CommitRowType.SECOND_IN_TWO_LINE_MODE;
    return html`
      ${this.renderCommitRowLeftSide({type})}
      ${this.renderCommitRowRightSide({type})}
    `;
  }

  private renderCommitRowLeftSide(options: {type: CommitRowType}) {
    const graphWidth = JjCommitRowLeftSide.getWidth(this.node);
    let tileGroups: TileGroup[];
    if (options.type === CommitRowType.ONE_LINE_MODE) {
      tileGroups = this.node.tileGroups;
    } else if (options.type === CommitRowType.FIRST_IN_TWO_LINE_MODE) {
      tileGroups = this.node.multiLineTileGroups.firstLine;
    } else {
      tileGroups = this.node.multiLineTileGroups.lastLine;
    }
    // Add a span as the wrapper to define the jj-commit-row-left-side's
    // absolute position.
    return html`<span style="margin-right: ${graphWidth}px">
      <jj-commit-row-left-side
        .state=${this.state}
        .extensionApi=${this.extensionApi}
        .node=${this.node}
        .tileGroups=${tileGroups}
        .type=${options.type}
      >
      </jj-commit-row-left-side
    ></span>`;
  }

  private renderCommitRowRightSide(options: {type: CommitRowType}) {
    const target = createCommitTarget(this.node);
    return html`<jj-drag-and-drop-publisher
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
        .type=${options.type}
      >
      </jj-commit-row-right-side>
    </jj-drag-and-drop-publisher>`;
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

  private insertMargin(margin: number) {
    return html`<span style="margin-left: ${margin}px"></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-commit-row': JjCommitRow;
  }
}
