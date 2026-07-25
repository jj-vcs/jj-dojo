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

import {
  Commit,
  CommitChildNode,
  CommitNode,
  InsertAction,
  Line,
  LineType,
} from '../api/types';
import {TileDrawer, getEmptyTileGroup} from './drawer';
import {Range, RangeManager} from './range_manager';

const ROOT_NODE_BASE: CommitNode = {
  isMagicRoot: true,
  hash: 'ROOT_NODE_UNIQUE_HASH',
  childrenHashes: [],
  shortDescription: '',
  fullDescription: '',
  isImmutable: true,
  active: false,
  isEmpty: true,
  hasConflict: false,
  hasDiverged: false,
  bookmarkChips: [],
  displayId: 'ROOT_NODE_DISPLAY_ID',
  highlightedDisplayIdLen: 0,
  updateTime: 0,
  isMultiSelected: false,

  children: [],
  parents: [],
  traverseOrder: 0,
  smallestTraverseOrder: 0,
  x: 0,
  y: 0,
  tileGroups: [],
  occupiedColumns: 0,
  descendants: new Set<string>(),
};

/**
 * Creates a map of commit nodes.
 */
export function createCommitNodes(commits: Commit[]): Map<string, CommitNode> {
  const nodesMap = new Map<string, CommitNode>();
  if (commits.length === 0) {
    return nodesMap;
  }
  for (const commit of commits) {
    const node: CommitNode = {
      ...commit,
      children: [],
      parents: [],
      isMagicRoot: false,
      traverseOrder: 0,
      smallestTraverseOrder: 0,
      x: 0,
      y: 0,
      tileGroups: [],
      occupiedColumns: 0,
      descendants: new Set<string>(),
    };
    nodesMap.set(node.hash, node);
  }

  // Populate the `parents` and `children` fields.
  for (const parent of nodesMap.values()) {
    for (const childHash of parent.childrenHashes) {
      const child = nodesMap.get(childHash);
      if (child === undefined) {
        throw new Error(
          `Commit ${parent.hash} has child ${childHash} which is not present in the commits array.`,
        );
      }
      child.parents.push(parent);
      parent.children.push({
        node: child,
        lineX: 0,
      });
    }
  }

  const disjointSets = setDisjointSetIdsForAllNodes(commits, nodesMap);
  const rootsForAllDisjointSets: CommitNode[] = [];
  for (const node of nodesMap.values()) {
    if (node.parents.length === 0) {
      rootsForAllDisjointSets.push(node);
    }
  }

  const yIncrementalCounter = new IncrementalCounter();
  for (let i = disjointSets - 1; i >= 0; --i) {
    const roots = rootsForAllDisjointSets.filter(
      (root) => root.disjointSetId === i,
    );
    let root: CommitNode;
    if (roots.length === 0) {
      throw new Error(
        `No roots found for disjoint set ${i}. This should not happen.`,
      );
    } else if (roots.length === 1) {
      root = roots[0];
    } else {
      root = {
        ...ROOT_NODE_BASE,
        // When there are multiple roots, create a magic root node that acts as
        // the parent of all roots.
        children: roots.map((root) => ({
          node: root,
          lineX: 0,
        })),
      };
    }

    setDescendantsFieldRecursively(nodesMap, root);
    optimizeChildrenOrder(nodesMap, root);
    fixRedundantLines(nodesMap);
    setYRecursively(root, yIncrementalCounter);
    setXRecursively(root, new RangeManager());
    setIsWorkingCopyCommitAncestorRecursively(root);
  }

  // `sortedNodes` can be calculated in linear time if they're processed
  // in `setYRecursively`. But realistically a commit graph shouldn't have
  // that many elements to make it worth the trouble.
  const sortedNodes: CommitNode[] = [];
  for (const node of nodesMap.values()) {
    sortedNodes.push(node);
  }
  sortedNodes.sort((a, b) => a.y - b.y);

  setTileGroupsForAllNodes(sortedNodes);

  setInsertActionForAllNodes(sortedNodes);

  setOccupiedColumnsForAllNodes(sortedNodes);

  return nodesMap;
}

/**
 * Optimizes the children order of the given node and all its descendants.
 *
 * The algorithm tries to place children that merges back to the left sooner
 * first. e.g. For the following graph:
 *  o c
 *  ├───┐
 *  o   │ b
 *  │   │
 *  │ o │ d
 *  ├─┘ │
 *  │   o e
 *  ├───┘
 *  o a
 *
 * Since e merges back to the left sooner than d (because d never merged back),
 * the algorithm would swap d and e, so a's new children order would be
 * [b, e, d], like this:
 *  o c
 *  ├─┐
 *  o │ b
 *  │ │
 *  │ o e
 *  ├─┘
 *  │ o d
 *  ├─┘
 *  o a
 *
 * However, if d also merges back to c, then both d and e merge back at the same
 * time. In this case, the algorithm respects the original children order
 * provided by the caller, and the swap does not happen.
 */
function optimizeChildrenOrder(
  nodesMap: Map<string, CommitNode>,
  root: CommitNode,
) {
  // If any of the children nodes were reordered, the `traverseOrder` of all
  // nodes becomes outdated, so we need to recompute it. Think of traverseOrder
  // as a number that represents how "left" you are in the graph. If the
  // children order is changed, then the "left"ness of all nodes are invalidated.
  //
  // The for loop is set to n^2 times based on the thought that each node can
  // be swapped with another sibling, and each node have less than n siblings.
  // So the total number of swaps before reaching the optimal order is bound by
  // n^2. However, in practice, the number of swaps should be much much less
  // than that.
  const totalSwaps = nodesMap.size * nodesMap.size;
  for (let i = 0; i <= totalSwaps; i++) {
    if (i === totalSwaps) {
      throw new Error(
        'The total number of swaps reached the maximum n^2 bound. This should not happen.',
      );
    }
    setTraverseOrderRecursively(root, new IncrementalCounter());
    setSmallestTraverseorderRecursively(root);
    if (maybeSwapChildren(root)) {
      for (const node of nodesMap.values()) {
        node.traverseOrder = 0;
        node.smallestTraverseOrder = 0;
      }
      continue;
    }
    break;
  }
}

function setDescendantsFieldRecursively(
  commitsMap: Map<string, CommitNode>,
  commit: CommitNode,
) {
  if (commit.descendants.size !== 0) {
    // The descendants field is already populated.
    return;
  }
  commit.descendants.add(commit.hash);
  for (const childHash of commit.childrenHashes) {
    const child = commitsMap.get(childHash);
    if (child === undefined) {
      throw new Error('Child commit not found');
    }
    setDescendantsFieldRecursively(commitsMap, child);
    for (const descendant of child.descendants) {
      commit.descendants.add(descendant);
    }
  }
}

/**
 * In jj, it's possible to have redundant lines in the graph. e.g.
 * @   C
 * ├─╮
 * │ ○ B
 * ├─╯
 * ○   A
 *
 * Since C is a descendant of B, it must be placed first in A's children order,
 * so it is drawn last. Note: As documented in the `setYRecursively` function,
 * we draw from right to left, so we can build a graph row by row from the
 * bottom up.
 *
 * What happens if we don't follow this rule? If we draw C first, then the
 * intermediate graph would look like this:
 * ○ C
 * │
 * ○ A
 * As you can see, there's no space for B. B can now only be placed on top of C,
 * which is wrong because it's a descendant of it.
 */
function fixRedundantLines(nodeMap: Map<string, CommitNode>) {
  for (const node of nodeMap.values()) {
    for (let i = 0; i < node.children.length; ++i) {
      const frontChild = node.children[i];
      for (let j = i + 1; j < node.children.length; ++j) {
        const backChild = node.children[j];
        if (frontChild.node.descendants.has(backChild.node.hash)) {
          // Move the back child to the front while keeping the original order.
          node.children = [
            ...node.children.slice(0, i),
            backChild,
            ...node.children.slice(i + 1, j),
            frontChild,
            ...node.children.slice(j + 1, node.children.length),
          ];
          --i;
          break;
        }
      }
    }
  }
}

class IncrementalCounter {
  private counter = 0;
  next() {
    return this.counter++;
  }
}

/**
 * Sets the traverseOrder field of the given node and all its descendants.
 *
 * @param node The node to set the traverseOrder field.
 * @param order An incremental counter that stores the next available
 * traverseOrder value.
 */
function setTraverseOrderRecursively(
  node: CommitNode,
  order: IncrementalCounter,
) {
  if (node.traverseOrder !== 0) {
    // Node has been visited before.
    return;
  }
  node.traverseOrder = order.next();
  for (const child of node.children) {
    setTraverseOrderRecursively(child.node, order);
  }
}

/**
 * Sets the smallestTraverseOrder field of the given node and all its
 * descendants.
 */
function setSmallestTraverseorderRecursively(node: CommitNode) {
  if (node.smallestTraverseOrder !== 0) {
    // Node has been visited before.
    return;
  }
  let smallest = node.traverseOrder;
  for (const child of node.children) {
    setSmallestTraverseorderRecursively(child.node);
    smallest = Math.min(smallest, child.node.smallestTraverseOrder);
  }
  node.smallestTraverseOrder = smallest;
}

/**
 * Swaps the children of the given node or any of its descendants if the
 * children order can be improved. If any child is swapped, stop early and
 * return true. Otherwise, after traversing all children, return false.
 *
 * @return Whether the children order was swapped.
 */
function maybeSwapChildren(node: CommitNode): boolean {
  const newChildrenOrder = node.children
    .map((value, index) => ({
      value,
      index,
    }))
    .sort((child1, child2) => {
      const order1 = child1.value.node.smallestTraverseOrder;
      const order2 = child2.value.node.smallestTraverseOrder;
      if (order1 !== order2) {
        return order1 - order2;
      }
      return child1.index - child2.index;
    })
    .map((child) => child.value);

  for (let i = 0; i < node.children.length; i++) {
    if (node.children[i].node.hash !== newChildrenOrder[i].node.hash) {
      node.children = newChildrenOrder;
      return true;
    }
  }

  for (const child of node.children) {
    if (maybeSwapChildren(child.node)) {
      return true;
    }
  }
  return false;
}

/**
 * Sets the y field of the given node and all its descendants.
 *
 * @param node The node to set the y field.
 * @param y An incremental counter that stores the next available y value.
 */
function setYRecursively(node: CommitNode, y: IncrementalCounter) {
  if (node.y !== 0) {
    // Node has been visited before.
    return;
  }
  if (!node.isMagicRoot) {
    node.y = y.next();
  }
  // Draw from right to left.
  for (let i = node.children.length - 1; i >= 0; --i) {
    const child = node.children[i];
    if (child.node.traverseOrder < node.traverseOrder) {
      continue;
    }
    setYRecursively(child.node, y);
  }
}

const CRITERIA = {
  fromSameParent: (existingRange: Range, newRange: Range) => {
    return existingRange.parentHash === newRange.parentHash;
  },
  toSameChild: (existingRange: Range, newRange: Range) => {
    return existingRange.childHash === newRange.childHash;
  },
};

/**
 * Sets the x field of the given node and all its descendants.
 *
 * @param node The node to set the x field.
 * @param originalManager The range manager to use.
 */
function setXRecursively(node: CommitNode, originalManager: RangeManager) {
  let x = -1;
  while (true) {
    if (x === 10000) {
      throw new Error('Unreachable: node.x should never be this large.');
    }
    ++x;
    const manager = originalManager.clone();

    // Reserve the space for the parent node.
    const nodeRange = {
      yStart: node.y - 1,
      yEnd: node.y,
      parentHash: node.hash,
      childHash: node.hash,
      canBeSharedBy: CRITERIA.toSameChild,
    };
    if (manager.reserve(x, nodeRange) === false) {
      // Space already taken. Try the next x.
      continue;
    }

    for (const child of node.children) {
      // Determine the child node's position.
      if (child.node.traverseOrder > node.traverseOrder) {
        // This is a merge-out, this means the child has not been visited before.
        setXRecursively(child.node, manager);
      }
      // Once the child node's position is determined, reserve the space for the
      // line connecting the parent node to the child node.
      let lineX = x;
      while (true) {
        const lineRange = {
          yStart: node.y,
          // When drawing a node, the algorithm already reserves one unit of vertical
          // space below the node. So there's no need to reserve the space again.
          yEnd: child.node.y - 1,
          parentHash: node.hash,
          childHash: child.node.hash,
          canBeSharedBy: CRITERIA.fromSameParent,
        };
        if (manager.reserve(lineX, lineRange)) {
          child.lineX = lineX;
          break;
        }
        ++lineX;
      }
    }

    // It's visually better for parent nodes to be placed at least as right as
    // the left-most child node.
    // e.g. Without the `minX` constraint, the graph would look like this:
    //  o
    //  │ o
    //  │ ├─┐
    //  │ o │
    //  ├─┘ │
    //  │ o─┘
    //  ├─┘
    //  o
    // With the `minX` constraint, the graph would look like this:
    //  o
    //  │ o
    //  │ ├─┐
    //  │ o │
    //  ├─┘ │
    //  │   o <-- this node moved to the right due to `minX` being 2 in this case.
    //  ├───┘
    //  o
    const minLineX =
      node.children.length === 0
        ? 0
        : Math.min(...node.children.map((child) => child.lineX));
    if (minLineX > x) {
      continue;
    }

    node.x = x;
    originalManager.replace(manager.rangeGroups);
    break;
  }
}

function isSpaceOccupyingLine(line: Line) {
  return (
    line.type !== LineType.RIGHT_TO_UP && line.type !== LineType.HORIZONTAL
  );
}

function setOccupiedColumnsForAllNodes(nodes: CommitNode[]) {
  for (const node of nodes) {
    node.occupiedColumns = node.tileGroups.length;
    while (node.occupiedColumns > 0) {
      const tileGroup = node.tileGroups[node.occupiedColumns - 1];
      if (
        tileGroup.top.lines.some(isSpaceOccupyingLine) ||
        tileGroup.glyph.lines.some(isSpaceOccupyingLine) ||
        tileGroup.bottom.lines.some(isSpaceOccupyingLine)
      ) {
        break;
      }
      --node.occupiedColumns;
    }
    const glyphColumn = node.x + 1;
    node.occupiedColumns = Math.max(node.occupiedColumns, glyphColumn);
  }
}

/**
 * Sets the tileGroups field for all nodes.
 *
 * @sortedNodes Nodes sorted by y in increasing order.
 * e.g. sortedNodes[0].y must be 0.
 *      sortedNodes[1].y must be 1.
 *      sortedNodes[n].y must be n.
 */
function setTileGroupsForAllNodes(sortedNodes: CommitNode[]) {
  for (const parent of sortedNodes) {
    for (const child of parent.children) {
      setTileGroupsForLine(sortedNodes, parent, child);
    }
  }
  for (const node of sortedNodes) {
    for (let x = node.tileGroups.length; x <= node.x; ++x) {
      node.tileGroups.push(getEmptyTileGroup());
    }
  }
}

/**
 * Sets the tileGroups field for a single line.
 *
 * @param sortedNodes Nodes sorted by y in increasing order.
 * @param parent The parent node of the line.
 * @param childAndLine The child node, and the line connecting the parent node
 * to the child node.
 */
function setTileGroupsForLine(
  sortedNodes: CommitNode[],
  parent: CommitNode,
  childAndLine: CommitChildNode,
) {
  const base = {parent, child: childAndLine};
  const child = childAndLine.node;
  const lineX = childAndLine.lineX;

  const drawer = new TileDrawer(sortedNodes, base, parent.x, parent.y);

  if (parent.x === child.x && parent.x === lineX) {
    // Vertical line
    //  ┌─────┐
    //  │     │ Child top
    //  │  o  │ Child glyph
    //  │  │  │ Child bottom
    //  └─────┘
    //  │  │  │ Intermediate(s) top
    //  │  │  │ Intermediate(s) glyph
    //  │  │  │ Intermediate(s) bottom
    //  └─────┘
    //  │  │  │ Parent top
    //  │  o  │ Parent glyph
    //  │     │ Parent bottom
    //  └─────┘
    drawer.up((child.y - parent.y - 1) * 3 + 2);
    return;
  }

  if (parent.x === lineX && parent.x < child.x) {
    //    Merging out - most common scenario
    //   ┌───────────────┐
    //   │               │ Child top
    //   │            o  │ Child glyph
    //   │            │  │ Child bottom
    //   └───────────────┘
    //   │  ┌─────────┘  │ Intermediate(s) top
    //   │  │            │ Intermediate(s) glyph
    //   │  │            │ Intermediate(s) bottom
    //   └───────────────┘
    //   │  │            │ Parent top
    //   │  o            │ Parent glyph
    //   │               │ Parent bottom
    //   └───────────────┘
    drawer.up((child.y - parent.y - 1) * 3);
    drawer.upToRight();
    drawer.right(child.x - parent.x - 1);
    drawer.rightToUp();
    return;
  }

  if (child.x === lineX && parent.x < child.x) {
    //    Merging out - rare scenario
    //   ┌───────────────┐
    //   │               │ Child top
    //   │            o  │ Child glyph
    //   │            │  │ Child bottom
    //   └───────────────┘
    //   │            │  │ Intermediate(s) top
    //   │            │  │ Intermediate(s) glyph
    //   │            │  │ Intermediate(s) bottom
    //   └───────────────┘
    //   │  ┌─────────┘  │ Parent top
    //   │  o            │ Parent glyph
    //   │               │ Parent bottom
    //   └───────────────┘
    drawer.upToRight();
    drawer.right(child.x - parent.x - 1);
    drawer.rightToUp();
    drawer.moveUp();
    drawer.up((child.y - parent.y - 1) * 3);
    return;
  }

  if (parent.x < lineX && lineX < child.x) {
    //    Merging out - another rare scenario
    //   ┌───────────────┐
    //   │               │ Child top
    //   │            o  │ Child glyph
    //   │       ┌────┘  │ Child bottom
    //   └───────────────┘
    //   │       │       │ Intermediate(s) top
    //   │       │       │ Intermediate(s) glyph
    //   │       │       │ Intermediate(s) bottom
    //   └───────────────┘
    //   │  ┌────┘       │ Parent top
    //   │  o            │ Parent glyph
    //   │               │ Parent bottom
    //   └───────────────┘
    drawer.upToRight();
    drawer.right(lineX - parent.x - 1);
    drawer.rightToUp();
    drawer.moveUp();
    drawer.up((child.y - parent.y - 1) * 3 - 2);
    drawer.upToRight();
    drawer.right(child.x - lineX - 1);
    drawer.rightToUp();
    return;
  }

  if (parent.x === lineX && parent.x > child.x) {
    //    Merging back Simple scenario
    //   ┌───────────────┐
    //   │               │ Child top
    //   │   o           │ Child glyph
    //   │   │           │ Child bottom
    //   └───────────────┘
    //   │   └────────┐  │ Intermediate(s) top
    //   │            │  │ Intermediate(s) glyph
    //   │            │  │ Intermediate(s) bottom
    //   └───────────────┘
    //   │            │  │ Parent top
    //   │            o  │ Parent glyph
    //   │               │ Parent bottom
    //   └───────────────┘
    drawer.up((child.y - parent.y - 1) * 3);
    drawer.upToLeft();
    drawer.left(parent.x - child.x - 1);
    drawer.leftToUp();
    return;
  }
  //    Merging back Complicated Scenario
  //   ┌────────────────────────┐
  //   │                        │ Child top
  //   │   o                    │ Child glyph
  //   │   │                    │ Child bottom
  //   └────────────────────────┘
  //   │   └────────────────┐   │ Intermediate(s) top
  //   │                    │   │ Intermediate(s) glyph
  //   │                    │   │ Intermediate(s) bottom
  //   └────────────────────────┘
  //   │           ┌────────┘   │ Parent top
  //   │           o            │ Parent glyph
  //   │                        │ Parent bottom
  //   └────────────────────────┘
  drawer.upToRight();
  drawer.right(lineX - parent.x - 1);
  drawer.rightToUp();
  drawer.moveUp();
  drawer.up((child.y - parent.y - 1) * 3 - 2);
  drawer.upToLeft();
  drawer.left(lineX - child.x - 1);
  drawer.leftToUp();
}

function setIsWorkingCopyCommitAncestorRecursively(node: CommitNode) {
  if (node.isWorkingCopyCommitAncestor !== undefined) {
    // Node has been visited before.
    return;
  }
  node.isWorkingCopyCommitAncestor = false;
  if (node.active) {
    node.isWorkingCopyCommitAncestor = true;
    return;
  }
  for (const child of node.children) {
    setIsWorkingCopyCommitAncestorRecursively(child.node);
    if (child.node.isWorkingCopyCommitAncestor) {
      node.isWorkingCopyCommitAncestor = true;
    }
  }
}

function setDisjointSetIdsForAllNodes(
  commits: Commit[],
  nodesMap: Map<string, CommitNode>,
): number {
  let disjointSetCount = 0;
  // Set the disjoint set id in the same order as the incoming commits.
  for (const commit of commits) {
    const node = nodesMap.get(commit.hash);
    if (node === undefined) {
      throw new Error(`Commit ${commit.hash} not found in the nodes map.`);
    }
    if (node.disjointSetId === undefined) {
      setDisjointSetIdRecursively(node, disjointSetCount);
      ++disjointSetCount;
    }
  }
  return disjointSetCount;
}

function setDisjointSetIdRecursively(node: CommitNode, disjointSetId: number) {
  if (node.disjointSetId !== undefined) {
    // Already visited.
    return;
  }
  node.disjointSetId = disjointSetId;
  for (const parent of node.parents) {
    setDisjointSetIdRecursively(parent, disjointSetId);
  }
  for (const child of node.children) {
    setDisjointSetIdRecursively(child.node, disjointSetId);
  }
}

/**
 * Pre-computes the insert action when hovering over a tile.
 */
function setInsertActionForAllNodes(sortedNodes: CommitNode[]) {
  for (const [y, node] of sortedNodes.entries()) {
    for (const [i, tileGroup] of node.tileGroups.entries()) {
      const shouldDrawGlyph = node.x === i;
      // A special case when hovering over a tile with a glyph.
      if (shouldDrawGlyph) {
        // Top tile
        if (node.children.length === 0) {
          // If there are no children, most of the times there is no insert
          // action. But there could be horizontal lines from other tiles that
          // passes through, so we still need to call the `calculateInsertAction`
          // helper function.
          tileGroup.top.insertAction = calculateInsertAction(
            tileGroup.top.lines,
          );
        } else if (node.children.length === 1) {
          // If there is only one child, we should show 'insert here' instead
          // of 'insert as common parent'.
          tileGroup.top.insertAction = insertHere({
            parent: node,
            child: node.children[0],
          });
        } else if (node.children.length > 1) {
          // If there are multiple children, we should show 'insert as common
          // parent'. This is expressed by setting the `to` field to undefined.
          tileGroup.top.insertAction = insertAsCommonParent({
            parent: node,
          });
        }
        // Bottom tile
        if (node.parents.length === 1) {
          // Action is "Insert here" instead of "Insert as common child".
          tileGroup.bottom.insertAction = insertHere({
            parent: node.parents[0],
            child: getSelfAsCommitChildNode({
              self: node,
              parent: node.parents[0],
            }),
          });
        } else if (node.parents.length > 1) {
          // Action is "Insert as common child". This is expressed by setting the
          // `from` field to undefined.
          tileGroup.bottom.insertAction = insertAsCommonChild({
            child: node,
          });
        }
      } else {
        // Some lines like horizontal lines are rendered on the border between
        // two tiles. To avoid browser subpixel rendering bugs, we render the
        // whole line on the tile below, and move it up to make it appear as if
        // it's on the border.
        // But for the user, they would expect hovering over the tile above to
        // still show the insert action for the line. So we need to also consider
        // the horizontal lines from the tile below when calculating the insert
        // action for the current tile.
        const extraLinesToConsider: Line[] = [];
        const tileGroupBelow = sortedNodes[y - 1]?.tileGroups[i];
        if (tileGroupBelow !== undefined) {
          extraLinesToConsider.push(
            ...tileGroupBelow.top.lines.filter(
              (line) =>
                line.type === LineType.HORIZONTAL ||
                line.type === LineType.RIGHT_TO_UP,
            ),
          );
        }
        tileGroup.top.insertAction = calculateInsertAction(tileGroup.top.lines);
        tileGroup.glyph.insertAction = calculateInsertAction(
          tileGroup.glyph.lines,
        );
        tileGroup.bottom.insertAction = calculateInsertAction([
          ...tileGroup.bottom.lines,
          ...extraLinesToConsider,
        ]);
      }
    }
  }
}

function getSelfAsCommitChildNode(data: {
  self: CommitNode;
  parent: CommitNode;
}): CommitChildNode {
  const self = data.parent.children.find((child) => child.node === data.self);
  if (self === undefined) {
    throw new Error('Program error. Cannot find self in parent.children');
  }
  return self;
}

function calculateInsertAction(lines: Line[]): InsertAction | undefined {
  if (lines.length === 0) {
    return undefined;
  }
  if (lines.length === 1) {
    const line = lines[0];
    return insertHere(line);
  }

  // If they are all from the same parent
  if (lines.every((line) => line.parent === lines[0].parent)) {
    const parent = lines[0].parent;
    const children = new Set<string>(
      parent.children.map((child) => child.node.hash),
    );
    for (const line of lines) {
      children.delete(line.child.node.hash);
    }
    if (children.size === 0) {
      // All children are accounted for.
      return insertAsCommonParent({parent});
    } else {
      // Not all children are accounted for.
      // Pick the left-most child as the destination.
      return insertHere(lines[0]);
    }
  }

  // If they are all going to the same child.
  if (lines.every((line) => line.child.node === lines[0].child.node)) {
    const child = lines[0].child.node;
    const parents = new Set<string>(child.parents.map((parent) => parent.hash));
    for (const line of lines) {
      parents.delete(line.parent.hash);
    }
    if (parents.size === 0) {
      // All parents are accounted for.
      return insertAsCommonChild({child});
    } else {
      // Not all parents are accounted for.
      let leftMostLine = lines[0];
      for (const line of lines) {
        if (line.child.lineX < leftMostLine.child.lineX) {
          leftMostLine = line;
        }
      }
      return insertHere(leftMostLine);
    }
  }

  // Prefer horizontal lines
  const horizontalLines = lines.filter(
    (line) => line.type === LineType.HORIZONTAL,
  );
  if (lines.length > horizontalLines.length) {
    return calculateInsertAction(horizontalLines);
  }

  // Multiple sources and multiple destinations.
  return undefined;
}

function insertHere(data: {
  parent: CommitNode;
  child: CommitChildNode;
}): InsertAction {
  const {parent, child} = data;
  const insertNode = getInsertNode(parent, child);
  const insertHint = {
    // We don't want the hint text to cover the parent/child nodes, or
    // the line itself, so we push it to the right.
    x: Math.max(parent.x, child.node.x, child.lineX),
    y: insertNode.y,
  };
  return {
    from: parent,
    to: child.node,
    insertNode,
    insertHint,
  };
}

function insertAsCommonParent(data: {parent: CommitNode}): InsertAction {
  const {parent} = data;
  return {
    from: parent,
    to: undefined,
    insertNode: {
      x: parent.x,
      y: parent.y + 0.5,
    },
    insertHint: {
      x: parent.x,
      y: parent.y,
    },
  };
}

function insertAsCommonChild(data: {child: CommitNode}): InsertAction {
  const {child} = data;
  return {
    from: undefined,
    to: child,
    insertNode: {
      x: child.x,
      y: child.y - 0.5,
    },
    insertHint: {
      x: child.x,
      y: child.y,
    },
  };
}

function getInsertNode(
  parent: CommitNode,
  childAndLine: CommitChildNode,
): {x: number; y: number} {
  const child = childAndLine.node;
  const lineX = childAndLine.lineX;
  if (parent.x === child.x && parent.x === lineX) {
    // Vertical line.
    //  o b
    //  │ ⬅ draw here
    //  o a
    // If they are next to each other vertically, draw the hint node
    // in the middle between the two tiles.
    // Otherwise, draw the hint node one tile below the destination node.
    // We don't draw midway in this case because there could be more branches
    // forked after the midway point.
    return {
      x: parent.x,
      y: parent.y === child.y - 1 ? child.y - 0.5 : child.y - 1,
    };
  }

  if (parent.x === lineX && parent.x < child.x) {
    // Merge out - most common scenario.
    //        o
    //   ┌────┘
    //   │ ⬆
    //   │ draw here
    //   │
    //   o
    //
    return {
      x: (parent.x + child.x) / 2,
      y: child.y - 0.5,
    };
  }

  if (child.x === lineX && parent.x < child.x) {
    // Merging out - rare scenario.
    //        o
    //        │ ⬅ draw here
    //        │
    //        │
    //   ┌────┘
    //   o
    return {
      x: child.x,
      y: child.y - 1,
    };
  }

  if (parent.x < lineX && lineX < child.x) {
    // Merging out - another rare scenario.
    //             o
    //        ┌────┘
    //        │
    //        │⬅ draw here
    //        │
    //   ┌────┘
    //   o
    return {
      x: lineX,
      y: (parent.y + child.y) / 2,
    };
  }

  if (parent.x === lineX && parent.x > child.x) {
    // Merging back - simple scenario.
    if (parent.y === child.y - 1) {
      //             draw here
      //   o         ⬇
      //   └─────────────┐
      //                 o
      return {
        // Merge back lines are shared. If we draw the hint node midway,
        // it may look bad. This only occurs in very complicated graphs
        // though.
        //          drawing here is bad
        //   o      ⬇
        //   └──────┐───────┐
        //          │       o
        //          o
        x: parent.x - 0.5,
        y: child.y - 0.5,
      };
    } else {
      //   o
      //   └─────────────┐
      //                 │ ⬅ draw here
      //                 │
      //                 │
      //                 │
      //                 o
      return {
        x: parent.x,
        y: child.y - 1,
      };
    }
  }

  // Merging back complicated scenario.
  //    o
  //    └────────┐
  //             │
  //             │⬅ draw here
  //             │
  //        ┌────┘
  //        o
  return {
    x: lineX,
    y: (parent.y + child.y) / 2,
  };
}
