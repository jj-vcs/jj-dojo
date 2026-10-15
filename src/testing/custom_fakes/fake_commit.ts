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

import {ChangeId, CommitId, MutableCommit} from '../../api/api';
import {HashSet} from '../../utils/hashset';

/**
 * Creates a new fake commit for testing.
 */
export function fakeCommit(
  options: Partial<MutableCommit> = {},
): MutableCommit {
  const description = options.description ?? '';
  return {
    id: new CommitId(''),
    changeId: new ChangeId(''),
    childIds: [],
    parentIds: [],
    active: false,
    isWorkingCopyParentCommit: false,
    description,
    descriptionTitle: description.split(/\r?\n/)[0],
    updateTime: 0,
    createdTime: 0,
    hasConflict: false,
    hasDiverged: false,
    displayId: '',
    highlightedDisplayIdLen: 1,
    changeOffset: undefined,
    ancestors: new HashSet<CommitId>(),
    descendants: new HashSet<CommitId>(),
    ...options,
  };
}
