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
 * The width of a tile in the graph.
 */
export const TILE_WIDTH = 14;

/**
 * The height of a tile in the graph.
 */
export const TILE_HEIGHT = 14;

/**
 * The radius of a circle in the graph.
 */
export const CIRCLE_RADIUS = 5;

/**
 * The stroke width of a line in the graph.
 */
export const STROKE_WIDTH = 1.5;

/**
 * The height of the top or bottom tiles in the graph.
 */
export const MERGE_TILE_HEIGHT = 5;

/**
 * The height of a commit row in the graph.
 */
export const COMMIT_ROW_HEIGHT = TILE_HEIGHT + 2 * MERGE_TILE_HEIGHT;

/**
 * The height of the top bar in the graph.
 */
export const TOP_BAR_HEIGHT = 35;

/**
 * The gap between the child elements of a commit row.
 */
export const COMMIT_ROW_CHILD_ELEMENTS_GAP = 4;
