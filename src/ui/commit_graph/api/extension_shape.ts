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

/**
 * The api provided by the extension to the webview.
 * i.e. The extension implements these methods, and the webview calls them.
 */
export interface ExtensionShape {
  /**
   * Called when the webview is ready.
   */
  $webviewReady(): Promise<void>;

  /**
   * Executes a VS Code command.
   *
   * @param command The command to execute.
   * @param args The arguments to pass to the vs code command.
   * @param repoName The name of the repository provided in
   * WebviewShape.setState. If no repo name was provided, this field will
   * also be left undefined.
   */
  $executeCommand(
    repoName: string | undefined,
    command: string,
    args?: unknown[],
  ): Promise<void>;

  /**
   * Provides information about the new order of the commits in the graph.
   */
  $informNewOrder(repoName: string | undefined, order: Order): Promise<void>;

  /**
   * Called right before a context menu is opened. This is used for the
   * extension to calculate what options to show as enabled or disabled in the
   * context menu.
   *
   * @param hash The hash of the commit to open the context menu for. If
   * undefined, default to the current working copy commit.
   */
  $informContextMenuWillOpen(
    repoName: string | undefined,
    hash: string | undefined,
  ): Promise<void>;

  /**
   * Called when a user clicks on a commit row.
   *
   * @param hash The hash of the commit that is currently selected.
   * @param metaKey Whether the meta key is pressed.
   */
  $onClick(
    repoName: string | undefined,
    hash: string,
    metaKey: boolean,
    shiftKey: boolean,
  ): Promise<void>;

  /**
   * Called when a user clears the multi-selection of commits.
   */
  $clearMultiSelection(repoName: string | undefined): Promise<void>;

  /**
   * Called when a user dismisses a callout message.
   */
  $dismissCallout(dismissId: string): Promise<void>;
}

/**
 * The order of the commits in the graph.
 */
export interface Order {
  // The updated order of the children commits according to how they are
  // currently displayed in the graph.
  childrenOrder: ChildrenOrder[];

  // The hashes of the commits from top to bottom.
  // e.g. if the graph looks like
  //  o a
  //  │ o b
  //  ├─┘
  //  │ @ c
  //  ├─┘
  //  o d
  // then this field would be [a, b, c, d].
  topToBottomOrder: string[];

  // The index of the working copy commit in the topToBottomOrder array.
  // If there is no working copy commit, this field will be -1.
  // In the example above, the working copy commit is 'c', so this field would
  // be 2.
  wcCommitIndex: number;
}

/**
 * The order of the children commits.
 */
export interface ChildrenOrder {
  // The hash of the parent commit.
  parentHash: string;
  // The hashes of the children commits, in the order they are displayed in the
  // graph.
  childrenHashes: string[];
}
