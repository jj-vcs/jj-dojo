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

import {getFocusedCommits} from '../algorithms/focus_mode';
import {createCommitNodes} from '../algorithms/preprocess';
import {css, html} from 'lit';
import {customElement, property} from 'lit/decorators';
import {styleMap} from 'lit/directives/style-map';
import 'vscode-elements/main'; // go/lit-style#importing-elements
import type {ExtensionShape} from '../api/extension_shape';
import type {CommitGraphState} from '../api/types';
import {CommitNode} from '../api/types';
import {JjResizeController} from './resize_controller';

import './commit_graph';

interface StateAndNodes {
  state: CommitGraphState;
  // All nodes of the graph sorted by their y-coordinate in descending order.
  sortedNodes: CommitNode[];
}

/**
 * Root of the commit graph app.
 */
@customElement('jj-app')
export class JjApp extends JjResizeController {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
  `;

  @property({attribute: false}) extensionApi?: ExtensionShape;
  @property({attribute: false}) states: StateAndNodes[] = [];

  async setStates(states: CommitGraphState[]) {
    this.states = [];
    for (const state of states) {
      const commits = state.options.disableFocusMode
        ? getFocusedCommits(state.commits)
        : state.commits;
      const nodesMap = createCommitNodes(commits);
      const sortedNodes = [...nodesMap.values()].sort((a, b) => b.y - a.y);
      void this.extensionApi?.$informNewOrder(state.repoName, {
        childrenOrder: sortedNodes.map((node) => ({
          parentHash: node.hash,
          childrenHashes: node.children.map((child) => child.node.hash),
        })),
        topToBottomOrder: sortedNodes.map((node) => node.hash),
        wcCommitIndex: sortedNodes.findIndex((node) => node.active),
      });
      state.multiSelectionMode =
        sortedNodes.filter((commit) => commit.isMultiSelected).length > 1;
      state.unfocusedCommits = state.commits.length - commits.length;
      this.states.push({
        state,
        sortedNodes,
      });
    }
    // Wait for the next animation frame to ensure that the UI has been
    // updated with the new states.
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }

  override render() {
    const extensionApi = this.extensionApi;
    if (!extensionApi) {
      return html``;
    }
    return html`${this.states.map(
      ({state, sortedNodes}) =>
        html`<jj-commit-graph
          style=${styleMap({
            width: this.renderedWidth ? `${this.renderedWidth}px` : '100%',
          })}
          .extensionApi=${extensionApi}
          .state=${state}
          .sortedNodes=${sortedNodes}
          @contextmenu=${async (event: MouseEvent) => {
            // Eat the context menu event. Otherwise VS Code shows a default
            // Cut/Copy/Paste menu that doesn't do anything.
            event.preventDefault();
          }}
        ></jj-commit-graph>`,
    )}`;
  }

  private readonly onClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).id !== 'jj-app') {
      for (const state of this.states) {
        void this.extensionApi?.$clearMultiSelection(state.state.repoName);
      }
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('click', this.onClick);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('click', this.onClick);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-app': JjApp;
  }
}
