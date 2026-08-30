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

import {CommitGraphState, CommitMetadataTextStyle, RenderMode} from '../api/types';
import {devCallouts} from './dev_callouts';
import {devCommits} from './dev_commits';
import {devTopBarButtons} from './dev_top_bar_buttons';

export function devState(): CommitGraphState {
  return {
    repoName: 'jj-dojo',
    callouts: devCallouts(),
    commits: devCommits(),
    topBarButtons: devTopBarButtons(),
    options: {
      showChangeId: true,
      alwaysShowActions: false,
      showContextMenuIcon: true,
      commitMetadataTextStyle:
        CommitMetadataTextStyle.SHOW_EMPTY_AND_NO_DESCRIPTION_SET,
      dragAndDropCommands: {
        rebase: {command: 'jj.rebase'},
        abandon: {command: 'jj.abandon'},
        insert: {command: 'jj.insert'},
      },
      renderMode: RenderMode.AUTO,
    },
  };
}
