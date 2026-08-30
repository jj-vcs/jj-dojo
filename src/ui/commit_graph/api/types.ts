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
 * A commit in the commit graph containing information provided by the caller.
 */
export interface Commit {
  // A unique identifier for the given commit.
  readonly hash: string;

  // All children of the given commit. Children should be provided in the order
  // they should be displayed. The graph algorithm tries to respect this order,
  // but would override it if reordering would result in a better graph.
  //
  // The caller must guarantee that all provided children are present in the
  // commits array, otherwise an error is thrown.
  readonly childrenHashes: readonly string[];

  readonly shortDescription: string;

  readonly fullDescription: string;

  // If true, the commit is immutable.
  readonly isImmutable?: boolean;

  readonly active?: boolean;

  // If true, the commit is empty.
  readonly isEmpty: boolean;

  readonly hasConflict?: boolean;

  readonly hasDiverged?: boolean;

  readonly bookmarkChips: SplitBookmarkChip[];

  // The icon buttons to show when hovered over the commit row.
  readonly iconButtons?: IconButton[];

  // The command to execute when the commit row is double clicked.
  readonly dblClick?: VSCodeCommand;

  // See `Commit.displayId` in api.ts
  readonly displayId: string;

  // See `Commit.highlightedDisplayIdLen` in api.ts
  readonly highlightedDisplayIdLen: number;

  // The commit's last updated timestamp (milliseconds since epoch).
  readonly updateTime: number;

  // If true, the commit is currently multi-selected.
  readonly isMultiSelected: boolean;

  // Object merged into the data-vscode-context attribute when the context
  // menu is opened for the commit row.
  readonly vscodeContext?: {[key: string]: unknown};
}

/**
 * An icon button (a button that has an icon but no text).
 */
export interface IconButton {
  // The command to execute when the button is clicked.
  // `command.title` is ignored since these buttons don't show titles.
  // e.g.
  // {
  //   command: 'jj.new',
  //   tooltip: 'New child commit',
  //   arguments: ['hash'],
  // }
  command: VSCodeCommand;

  // The codicon to display for the button e.g. "split-vertical".
  icon: string;
}

/**
 * The colors of a bookmark chip.
 */
export interface BookmarkChipColors<T> {
  readonly background: T;
  readonly foreground: T;
  readonly border: T;
}

/**
 * A VS Code command.
 */
export interface VSCodeCommand {
  // The title of the command. e.g. `New commit`
  title?: string;
  // The identifier of the command. e.g. `jj.new`
  command: string;
  tooltip?: string;
  arguments?: unknown[];
}

/**
 * The style of commit metadata tags for commits in the graph.
 */
export enum CommitMetadataTextStyle {
  SHOW_EMPTY_AND_NO_DESCRIPTION_SET = 'show empty/no description set',
  SHOW_EMPTY_AND_HAS_CHANGES = 'show empty/has changes',
}

/**
 * Options for the commit graph.
 */
export interface CommitGraphOptions {
  // Whether to show the display id of commits in the graph.
  readonly showChangeId: boolean;

  // If set, commits will be draggable and droppable.
  readonly dragAndDropCommands?: {
    // Called when dropped on top of another commit.
    // Two extra arguments will be appended to `VSCodeCommand.arguments`:
    //   First extra argument: [sourceCommitId1, sourceCommitId2, ...]
    //   Second extra argument: destCommitId
    // `title` and `tooltip` are ignored.
    rebase: VSCodeCommand;
    // Called when dropped on the garbage section.
    // All selected commit's id will be appended to `VSCodeCommand.arguments`.
    // `title` and `tooltip` are ignored.
    abandon: VSCodeCommand;
    // Called when dropped on a line between two commits.
    // An extra argument will be appended to `VSCodeCommand.arguments`:
    //   {
    //     // The commit(s) that will be moved.
    //     target: [hex1, hex2, ...]
    //     // The commit(s) that will become the children of `target` after the
    //     // move.
    //     insertBefore: [hex1, hex2, ...];
    //     // The commit(s) that will be the parents of `target` after the move.
    //     insertAfter: [hex1, hex2, ...];
    //   }
    insert: VSCodeCommand;
  };

  // Whether to always show commit row buttons in the graph.
  // If false (default), the buttons will only be shown when the row is hovered.
  readonly alwaysShowActions: boolean;

  // The scaling factor for the UI.
  // The extension should set this to the value of `cssOverrides.fontSizeScale`.
  // If not set, the default value is 1.
  readonly uiScaling?: number;

  // If set, the graph will hide any commits that are not ancestors of the
  // working copy commit. A 'disable focus mode' link will be rendered at the
  // bottom of the graph. Clicking the link will execute the given command.
  readonly disableFocusMode?: VSCodeCommand;

  // If true, an icon for the context menu will be shown in each commit row.
  readonly showContextMenuIcon?: boolean;

  // Style for commit metadata tags.
  readonly commitMetadataTextStyle?: CommitMetadataTextStyle;

  // If true, render each commit with two rows instead of one.
  readonly twoLineMode: boolean;
}

/**
 * The type of the callout message.
 */
export enum CalloutType {
  UNSTYLED = 'UNSTYLED',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

/**
 * A callout message in the commit graph.
 */
export interface Callout {
  readonly type: CalloutType;
  // The message to display in the callout, can contain HTML, e.g. links.
  readonly message: string;
  /**
   * If set, the callout will have a dismiss button. The value of this
   * property will be used as an identifier for the callout.
   */
  readonly dismissId?: string;
  // Only used if dismissId is set. The style of the dismiss button/text.
  // If not set, default to 'button'.
  readonly dismissStyle?: 'button' | 'link';
}

/**
 * A button in the top bar.
 */
export interface TopBarButton {
  readonly left: {
    // The command to execute when the left side of the split button is clicked.
    readonly command: VSCodeCommand;
    // If true, the left side of the split button will be disabled.
    readonly disabled: boolean;
  };

  readonly right?: {
    // If defined, when clicking the right side of the split button, a context
    // menu will be opened with 'origin' set to this value. Then the caller can
    // define in their package.json what context menu items to show.
    // e.g. in the package.json:
    // {
    //   "command": "...",
    //   "when": "origin == 'commitButton'",
    // }
    // If undefined, a plain button is rendered without the right split.
    readonly origin: string;
    // If true, the right side of the split button will be disabled.
    readonly disabled: boolean;
  };
}

/**
 * The state of the commit graph.
 */
export interface CommitGraphState {
  // The name of the repository. If undefined, the graph will not render the
  // repo name.
  readonly repoName?: string;

  // If set, the graph will render callout messages at the top of the graph.
  readonly callouts: Callout[];

  readonly commits: Commit[];

  // If empty, the top bar will not be rendered.
  // If a single element is provided, the top bar will render a single button
  // that takes the full width of the top bar.
  // If multiple elements are provided, the top bar will render multiple split
  // buttons, where each element takes a fixed width.
  readonly topBarButtons: TopBarButton[];

  readonly options: CommitGraphOptions;

  // The extension should ignore this field. This is used internally by the
  // graph to determine what the behavior of individual UI components should be.
  multiSelectionMode?: boolean;

  // The extension should ignore this field. This is used internally by the
  // graph. This is the number of commits that are not focused.
  unfocusedCommits?: number;

  // If set, the graph will render the time ago title in the base commit row
  // instead of the default "Submitted" text.
  readonly timeAgoTitle?: string;
}

/**
 * A bookmark chip in the commit graph.
 */
export interface BookmarkChip {
  // The text to display in the chip.
  readonly text?: string;
  // The text to display in the chip when hovered. If undefined, `text` is used.
  readonly textOnHover?: string;
  readonly tooltip?: string;
  readonly link?: string;
  readonly underlineOnHover?: boolean;
  // The command to execute when the chip is clicked.
  // If set, the `link` field will be ignored.
  readonly command?: VSCodeCommand;
  readonly color: BookmarkChipColors<string>;
  // The codicon to display before `text`. e.g. codicon-comment
  readonly codiconBefore?: string;
  // The codicon to display after `text`.
  readonly codiconAfter?: string;
  // The minimum width of the chip.
  readonly minWidth?: number;
}

/**
 * A split bookmark chip in the commit graph.
 */
export interface SplitBookmarkChip {
  readonly left: BookmarkChip;

  readonly dragAndDropCommands?: {
    // Called when dropped on the garbage section.
    abandon: VSCodeCommand;

    // Called when the chip is dragged and moved to another commit.
    // The hovered commit's hash will be appended to `VSCodeCommand.arguments`.
    move: VSCodeCommand;
  };

  readonly right?: {
    readonly chip: BookmarkChip;
    /**
     * In split chips, the left and right border colors are ignored.
     * Instead, the split chip's border color is set to this value.
     */
    readonly borderColor: string;
  };

  // Object merged into the data-vscode-context attribute when the context
  // menu is opened for the chip. If undefined, no context menu will be opened.
  readonly vscodeContext?: {[key: string]: unknown};
}

/**
 * A file in a commit.
 */
export interface File {
  readonly path: string;
}

/**
 * A node in the commit graph. On top of `Commit`, it contains additional
 * information needed by the graph algorithm.
 */
export interface CommitNode extends Commit {
  children: CommitChildNode[];

  parents: CommitNode[];

  // Whether this node is a magic root node.
  // A magic root node is created when there are multiple roots in a disjoint
  // set. In this case, all roots are grouped under a single magic root node.
  isMagicRoot: boolean;

  // Hashes of all descendants of this node, including itself.
  descendants: Set<string>;

  // Whether this node is an ancestor of the working copy commit.
  // This is used to determine whether to give a stronger or lighter color to
  // the associated glyph icon and lines.
  isWorkingCopyCommitAncestor?: boolean;

  // All commits are grouped into disjoint sets. Each set will have an id,
  // starting from 0.
  // e.g.
  //  o a disjointSetId: 0
  //  │
  //  o b disjointSetId: 0
  //
  //  o e    disjointSetId: 1
  //  ├─┐
  //  o │ c  disjointSetId: 1
  //    o d  disjointSetId: 1
  disjointSetId?: number;

  // The order in which nodes are encountered during a left-to-right depth-first
  // search of the graph. This value is used to calculate `smallestTraverseOrder`,
  // which can help determine whether a node eventually merges back to a tree on
  // the left.
  //
  //  o      traverseOrder: 2, smallestTraverseOrder: 2
  //  ├───┐
  //  o   │  traverseOrder: 1, smallestTraverseOrder: 1
  //  │   │
  //  │ o │  traverseOrder: 3, smallestTraverseOrder: 3
  //  ├─┘ |
  //  │   o  traverseOrder: 4, smallestTraverseOrder: 2
  //  ├───┘
  //  o      traverseOrder: 0, smallestTraverseOrder: 0
  traverseOrder: number;

  // The smallest traverseOrder in all of this node's descendants.
  smallestTraverseOrder: number;

  // The position of the node on the x-axis
  // e.g. for the following commit graph
  //  o
  //  │ o <-- this commit
  //  ├─┘
  //  │ o
  //  ├─┘
  //  o
  // x would be 1
  x: number;

  // The position of the node on the y-axis
  // In the sample commit graph above, y would be 2.
  y: number;

  // The tile groups for each x-coordinate.
  // e.g. tileGroups[0] is the tile group for x = 0.
  tileGroups: TileGroup[];

  // The number of columns that are occupied by the commit graph.
  // Usually this is equal to tileGroups.length. But in some cases, such as when
  // the tiles are curving from up towards the right, most of the tile is empty,
  // so it shouldn't be counted as an occupied column. This value is used to
  // by commit_row_right_side.ts to determine how far left it can be rendered.
  occupiedColumns: number;
}

/**
 * Represents a child node of a commit node.
 */
export interface CommitChildNode {
  // The child node.
  node: CommitNode;

  // The x-coordinate of the line connecting the parent node to this node.
  // In most cases, this is equal to the parent node's `x`, or the child node's
  // `x`.
  lineX: number;
}

/**
 * Represents a set of tiles in the commit graph.
 *
 *        <-- commit C's top tile
 *  o C   <-- commit C's glyph tile
 *  ├───┐ <-- commit C's bottom tile
 *  │   │ <-- commit B's top tile
 *  o B │ <-- commit B's glyph tile
 *  │   │ <-- commit B's bottom tile
 *  |   |
 *  │   o D
 *  ├───┘
 *  │
 *  o A
 *
 * In the above case, commit C has two TileGroups.
 * The first tile group is for x = 0.
 * The second tile group is for x = 1.
 *
 * For the x = 0 TileGroup, it's consisted of the following tiles:
 *  top:    n/a
 *  glyph: o
 *  bottom: ├
 *
 * For the x = 1 TileGroup, it's consisted of the following tiles:
 *  top:    n/a
 *  glyph: n/a
 *  bottom: ─┐
 */
export interface TileGroup {
  top: Tile;
  glyph: Tile;
  bottom: Tile;
}

/**
 * Represents an action to insert a node into the commit graph.
 */
export type InsertAction = (
  | {
      // From a commit to multiple child commits.
      from: CommitNode;
      to: undefined;
    }
  | {
      // From multiple parent commits to a child commit.
      from: undefined;
      to: CommitNode;
    }
  | {
      // From a parent commit to a child commit.
      from: CommitNode;
      to: CommitNode;
    }
) & {
  // The hint node should be rendered at this position.
  insertNode: {
    // The must be either an integer or a float ending with .5 to
    // indicate that the node should be rendered between two rows.
    // e.g. 0, 1, 1.5, 2, etc.
    x: number;
    y: number;
  };
  // The hint text should be rendered at this position.
  insertHint: {
    x: number;
    y: number;
  };
};

/**
 * Represents a tile in the commit graph.
 */
export interface Tile {
  lines: Line[];
  insertAction?: InsertAction;
}

/**
 * Represents a line in the commit graph.
 */
export interface Line {
  type: LineType;
  // These are useful in the future when we need to support
  // insert-drag-and-drop.
  parent: CommitNode;
  child: CommitChildNode;
}

/**
 * The type of a line.
 */
export enum LineType {
  // A vertical line.
  VERTICAL = 'VERTICAL',
  // A horizontal line.
  HORIZONTAL = 'HORIZONTAL',
  //  o
  //  │
  //  │LEFT_TO_UP     UP_TO_LEFT
  //  └───────────────┐
  //                  │
  //                  │
  //                  │
  //  ┌───────────────┘
  //  │UP_TO_RIGHT     RIGHT_TO_UP
  //  │
  //  o
  UP_TO_RIGHT = 'UP_TO_RIGHT',
  UP_TO_LEFT = 'UP_TO_LEFT',
  RIGHT_TO_UP = 'RIGHT_TO_UP',
  LEFT_TO_UP = 'LEFT_TO_UP',
}
