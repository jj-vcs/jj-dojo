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

import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators';
import type {ExtensionShape} from '../api/extension_shape';
import type {CommitGraphState} from '../api/types';
import {CommitNode} from '../api/types';
import {createCommitTarget} from './drag_and_drop_state';

import './callout';
import './codicon';
import './commit_row';
import './focus_mode_text';
import './top_bar';

@customElement('jj-commit-graph')
class JjCommitGraph extends LitElement {
  static override styles = css`
    .repo-name-with-codicon {
      display: flex;
      gap: 5px;
      align-items: center;
      padding-left: 5px;
      padding-bottom: 3px;
    }
    .repo-name {
      font-weight: bold;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }
  `;

  // All nodes of the graph sorted by their y-coordinate in descending order.
  @property({attribute: false}) sortedNodes: CommitNode[] = [];
  @property({attribute: false}) extensionApi!: ExtensionShape;
  @property({attribute: false}) state!: CommitGraphState;

  override render() {
    return html`${this.renderRepoName()}${this.renderTopBar()}${this.renderCallouts()}
      <div>${this.renderCommitRows()}</div>
      <jj-focus-mode-text
        .state=${this.state}
        .extensionApi=${this.extensionApi}
      ></jj-focus-mode-text>`;
  }

  private renderRepoName() {
    if (this.state.repoName === undefined) {
      return html``;
    }
    return html`<div class="repo-name-with-codicon">
      <jj-codicon .codicon=${'codicon-repo'}></jj-codicon>
      <div class="repo-name">${this.state.repoName}</div>
    </div>`;
  }

  private renderTopBar() {
    if (
      !this.state ||
      !this.extensionApi ||
      this.state.topBarButtons.length === 0
    ) {
      return html``;
    }
    return html`<jj-top-bar
      .extensionApi=${this.extensionApi}
      .state=${this.state}
    ></jj-top-bar> `;
  }

  private renderCallouts() {
    return html`${this.state.callouts.map(
      (callout) =>
        html`<jj-callout
          .callout=${callout}
          .extensionApi=${this.extensionApi}
        ></jj-callout>`,
    )}`;
  }

  private renderCommitRows() {
    return html`${this.sortedNodes.map(
      (node) =>
        html`<jj-commit-row
          .extensionApi=${this.extensionApi}
          .state=${this.state}
          .node=${node}
          .nodes=${this.sortedNodes}
          .subscribedTarget=${createCommitTarget(node)}
        >
        </jj-commit-row>`,
    )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-commit-graph': JjCommitGraph;
  }
}
