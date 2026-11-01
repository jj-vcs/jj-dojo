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

import {logAndShowInternalError} from '../../logging/logging';

/**
 * Splits a config key into its section and key parts, using a dot as the
 * delimiter.
 *
 * @param sectionAndKey The full config key. e.g. 'jj.graph.focusMode'
 * @return The section and key parts of the config key. Using the example above,
 *     the return value would be ['jj', 'graph.focusMode'].
 */
export function parseConfigKey(
  sectionAndKey: string,
): [section: string, key: string] {
  const dotIndex = sectionAndKey.indexOf('.');
  if (dotIndex === -1) {
    throw logAndShowInternalError(`Invalid config key: ${sectionAndKey}`);
  }
  const section = sectionAndKey.substring(0, dotIndex);
  const key = sectionAndKey.substring(dotIndex + 1, sectionAndKey.length);
  if (section.length === 0 || key.length === 0) {
    throw logAndShowInternalError(`Invalid config key: ${sectionAndKey}`);
  }
  return [section, key];
}
