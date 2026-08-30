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

import {checkExhaustive} from '../utils/check';
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators';
import type {ExtensionShape} from '../api/extension_shape';
import type {CommitGraphState, CommitNode} from '../api/types';
import {CommitMetadataTextStyle} from '../api/types';
import {COMMIT_ROW_HEIGHT} from './constants';

import './commit_row_chip';
import './time_ago_text';

@customElement('jj-commit-row-title')
class JjCommitRowTitle extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      gap: 3px;
      width: 100%;
      overflow: hidden;
      align-items: center;
      height: ${COMMIT_ROW_HEIGHT}px;
    }
    .title {
      display: flex;
      gap: 3px;
      white-space: nowrap;
      flex-grow: 1;
      overflow: hidden;
    }
    .warning-text {
      color: var(--vscode-editorError-foreground);
    }
    .highlighted-text:not([isMultiSelected]) {
      color: var(--commit-row-highlighted-text);
    }
    .working-copy-text:not([isMultiSelected]) {
      color: var(--vscode-editorInfo-foreground);
    }
    .description-title-text {
      text-overflow: ellipsis;
      overflow: hidden;
    }
  `;

  @property({attribute: false}) node!: CommitNode;
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;

  override render() {
    return html`
      <div class="title">
        ${this.renderConflictText()} ${this.renderDivergentText()}
        ${this.renderCommitMetadataText()} ${this.renderShortDescription()}
      </div>
    `;
  }

  private renderConflictText() {
    if (this.node.hasConflict) {
      return html` <span class="warning-text">conflict</span> `;
    }
    return html``;
  }

  private renderDivergentText() {
    if (this.node.hasDiverged) {
      return html` <span class="warning-text">divergent</span> `;
    }
    return html``;
  }

  private renderCommitMetadataText() {
    const text = [];

    const isEmpty = this.node.isEmpty;
    const noDescriptionSet = this.node.shortDescription.length === 0;

    switch (this.state.options.commitMetadataTextStyle) {
      case undefined:
      case CommitMetadataTextStyle.SHOW_EMPTY_AND_NO_DESCRIPTION_SET:
        if (isEmpty) {
          text.push(this.renderHighlightedText('(empty)'));
        }
        if (noDescriptionSet) {
          text.push(this.renderHighlightedText('(no description set)'));
        }
        break;
      case CommitMetadataTextStyle.SHOW_EMPTY_AND_HAS_CHANGES:
        if (isEmpty && noDescriptionSet) {
          break;
        } else if (isEmpty) {
          text.push(this.renderHighlightedText('(empty)'));
        } else if (noDescriptionSet) {
          text.push(this.renderHighlightedText('(has changes)'));
        }
        break;
      default:
        checkExhaustive(this.state.options.commitMetadataTextStyle);
    }
    return html`${text}`;
  }

  private renderHighlightedText(text: string) {
    return html`
      <span
        class="highlighted-text"
        ?isMultiSelected=${this.node.isMultiSelected}
        >${text}</span
      >
    `;
  }

  private renderShortDescription() {
    if (this.node.isImmutable) {
      return html`<jj-time-ago-text
        class="description-title-text"
        .text=${this.state.timeAgoTitle}
        .node=${this.node}
      >
      </jj-time-ago-text>`;
    }
    return html`<div class="description-title-text">
      ${this.node.shortDescription}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-commit-row-title': JjCommitRowTitle;
  }
}
