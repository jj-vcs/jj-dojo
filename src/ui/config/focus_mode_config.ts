/**
 * @license
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

import {WriteBackConfigCache} from './write_back_config_cache';

let focusModeConfigCache: WriteBackConfigCache | undefined;

/**
 * A WriteBackConfigCache for the 'jj.graph.focusMode' config.
 */
export function getFocusModeConfigCache(): WriteBackConfigCache {
  if (focusModeConfigCache === undefined) {
    focusModeConfigCache = new WriteBackConfigCache(
      'jj.graph.focusMode',
      false,
      'jj.isFocusModeEnabled',
    );
  }
  return focusModeConfigCache;
}

/**
 * Disposes and removes the cached FocusModeConfigCache instance.
 */
export function removeFocusModeConfigCache() {
  focusModeConfigCache?.dispose();
  focusModeConfigCache = undefined;
}
