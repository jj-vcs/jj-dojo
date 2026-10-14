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

import {css, html, svg} from 'lit';
import {customElement, property} from 'lit/decorators';
import {styleMap} from 'lit/directives/style-map';
import type {ExtensionShape} from '../api/extension_shape';
import type {CommitGraphState, CommitNode, Tile} from '../api/types';
import {CommitRowType} from '../api/types';
import {COMMIT_ROW_HEIGHT, TILE_HEIGHT, TILE_WIDTH} from './constants';
import {isDraggable} from './drag_and_drop_publisher';
import {
  createCommitTarget,
  createInsertTarget,
  isNoopInsert,
} from './drag_and_drop_state';
import {JjDragAndDropAllTargetsSubscriber} from './drag_and_drop_subscriber';
import {svgAtSymbol, svgCircle, svgCross, svgDiamond} from './glyphs';
import {HINT_BUBBLE_STYLES} from './hint_bubble';
import {svgInsertHint} from './insert_hint';
import {svgInsertNode} from './insert_node';
import {getLineColor, getSvgLineGroup, type StyledLine} from './lines';
import {svgRebaseHint} from './rebase_hint';

import './drag_and_drop_publisher';

@customElement('jj-glyph-tile')
class JjGlyphTile extends JjDragAndDropAllTargetsSubscriber {
  static override styles = [
    HINT_BUBBLE_STYLES,
    css`
      :host {
        display: flex;
        width: ${TILE_WIDTH}px;
        height: ${TILE_HEIGHT}px;
        position: relative;
      }
      .svg-container {
        width: 100%;
        height: 100%;
      }
      svg {
        position: absolute;
        overflow: visible;
        width: 100%;
        height: 100%;
      }
    `,
  ];

  /** If set, the tile should draw the commit. */
  @property({attribute: false}) node!: CommitNode;
  @property({attribute: false}) state!: CommitGraphState;
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) glyphTile!: Tile;
  @property({attribute: false}) shouldDrawGlyph!: boolean;
  @property({attribute: false}) x!: number;
  @property({attribute: false}) type!: CommitRowType;

  override render() {
    const styles = styleMap({
      cursor: this.shouldDrawGlyph ? 'pointer' : undefined,
    });
    const target = this.shouldDrawGlyph
      ? createCommitTarget(this.node)
      : createInsertTarget(this.glyphTile.insertAction);
    const styledLines = this.glyphTile.lines.map((line) => ({
      line,
      ...getLineColor({
        line,
        dragged: this.dragged,
        hovered: this.hovered,
      }),
    }));
    const rebaseHint = this.renderRebaseHint();
    const insertHintAndNode = this.renderInsertHintAndNode();
    const svgStyles = styleMap({
      zIndex: String(
        this.getSvgZIndex(
          styledLines,
          Boolean(rebaseHint || insertHintAndNode),
        ),
      ),
    });

    return html`
      <jj-drag-and-drop-publisher
        .publishedTarget=${target}
        .state=${this.state}
        .extensionApi=${this.extensionApi}
        style=${styles}
      >
        <div
          draggable="${target !== undefined && isDraggable(target, this.state)}"
          class="svg-container"
        >
          <svg viewBox="0 0 ${TILE_WIDTH} ${TILE_HEIGHT}" style=${svgStyles}>
            ${this.renderLines(styledLines)} ${this.renderGlyph()} ${rebaseHint}
            ${insertHintAndNode}
          </svg>
        </div>
      </jj-drag-and-drop-publisher>
    `;
  }

  private getSvgZIndex(styledLines: StyledLine[], hasHint: boolean) {
    if (hasHint) {
      return 10;
    }
    return Math.max(0, ...styledLines.map((l) => l.priority));
  }

  private renderLines(styledLines: StyledLine[]) {
    return [...styledLines]
      .sort((a, b) => a.priority - b.priority)
      .map((styledLine) =>
        getSvgLineGroup(styledLine, {
          tileWidth: TILE_WIDTH,
          tileHeight: TILE_HEIGHT,
        }),
      );
  }

  private renderGlyph() {
    if (!this.shouldDrawGlyph) {
      return svg``;
    }
    const color = this.getGlyphColor();
    const glyphs = [];
    if (this.node.active) {
      glyphs.push(svgAtSymbol(color));
    } else if (this.node.isImmutable) {
      glyphs.push(svgDiamond(color));
    } else if (this.node.hasConflict) {
      glyphs.push(svgCross(color));
    } else {
      glyphs.push(svgCircle(color));
    }
    return svg`<g>${glyphs}</g>`;
  }

  private getGlyphColor() {
    const isDragged =
      this.dragged?.type === 'commit' && this.dragged.data === this.node;
    if (isDragged || this.isDragDestination()) {
      return 'var(--vscode-button-background)';
    }
    if (this.node.hasConflict) {
      return 'var(--vscode-editorError-foreground)';
    }
    if (
      this.dragged?.type !== 'commit' &&
      this.node.isWorkingCopyCommitAncestor
    ) {
      return 'var(--vscode-foreground)';
    }
    return 'var(--inactiveLineColor)';
  }

  private renderRebaseHint() {
    if (this.isDragDestination()) {
      return svgRebaseHint();
    }
    return undefined;
  }

  private isDragDestination() {
    return (
      this.shouldDrawGlyph &&
      this.dragged?.type === 'commit' &&
      this.dragged.data !== this.node &&
      ((this.hovered?.type === 'commit' && this.hovered.data === this.node) ||
        (this.hovered?.type === 'chip' && this.hovered.data.node === this.node))
    );
  }

  private renderInsertHintAndNode() {
    let hintText: string | undefined;
    if (this.dragged?.type === 'commit' && this.hovered?.type === 'insert') {
      const {from, to, insertNode, insertHint} = this.hovered.data;
      if (
        this.type === CommitRowType.SECOND_IN_TWO_LINE_MODE ||
        isNoopInsert(this.dragged, this.hovered)
      ) {
        return undefined;
      }
      if (this.shouldDrawGlyph && from === this.node && to === undefined) {
        hintText = 'Insert as common parent';
      } else if (
        this.shouldDrawGlyph &&
        from === undefined &&
        to === this.node
      ) {
        hintText = 'Insert as common child';
      } else if (
        from !== undefined &&
        to !== undefined &&
        Math.floor(insertNode.x) === this.x &&
        Math.floor(insertNode.y) === this.node.y
      ) {
        hintText = 'Insert between';
      }

      if (hintText) {
        return svg`${this.renderInsertNode(insertNode)}
        ${this.renderInsertHint(hintText, insertHint)}`;
      }
    }
    return undefined;
  }

  private renderInsertHint(
    hintText: string,
    insertHint: {x: number; y: number},
  ) {
    const skewX = (insertHint.x - this.x) * TILE_WIDTH;
    const skewY = (insertHint.y - this.node.y) * COMMIT_ROW_HEIGHT;
    return svgInsertHint(hintText, skewX, skewY);
  }

  private renderInsertNode(insertNode: {x: number; y: number}) {
    const skewX = (insertNode.x - this.x) * TILE_WIDTH;
    const skewY = (insertNode.y - this.node.y) * COMMIT_ROW_HEIGHT;
    return svgInsertNode(skewX, skewY);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-glyph-tile': JjGlyphTile;
  }
}
