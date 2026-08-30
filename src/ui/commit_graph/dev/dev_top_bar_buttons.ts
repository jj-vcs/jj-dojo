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

import {TopBarButton} from '../api/types';

export function devTopBarButtons(): TopBarButton[] {
  return [
    {
      left: {
        command: {title: 'Commit', command: 'jj.new'},
        disabled: false,
      },
      right: {
        origin: 'commitButton',
        disabled: false,
      },
    },
    {
      left: {
        command: {title: 'Squash', command: 'jj.squash'},
        disabled: false,
      },
    },
    {
      left: {
        command: {title: 'Sync All', command: 'jj.sync'},
        disabled: false,
      },
    },
    {
      left: {
        command: {title: 'Upload', command: 'jj.upload'},
        disabled: false,
      },
    },
  ];
}
