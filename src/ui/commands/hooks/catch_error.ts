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

import {VscodeCommandCallback} from '../types';
import {logAndShowUserError} from '../../../logging/logging';

export function catchError(cb: VscodeCommandCallback): VscodeCommandCallback {
  return async (...args) => {
    try {
      return await cb(...args);
    } catch (unknownError: unknown) {
      // Let's catch the error here to avoid VSCode showing a big modal in
      // the middle of the screen.
      logAndShowUserError(unknownError);
    }
  };
}
