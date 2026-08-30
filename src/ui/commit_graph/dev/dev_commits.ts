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

import {Commit, IconButton} from '../api/types';

const mainChipColor = {
  background: '#1b4d27',
  foreground: '#85e89d',
  border: '#2c7a3f',
};

const workingCopyChipColor = {
  background: '#04395e',
  foreground: '#75beff',
  border: '#1177bb',
};

const featureChipColor = {
  background: '#3b2d54',
  foreground: '#d2a8ff',
  border: '#6e40a6',
};

const now = Date.now();

export function devIconButtons(): IconButton[] {
  return [
    {
      command: {title: 'New child commit', command: 'jj.new'},
      icon: 'add',
    },
    {
      command: {title: 'Edit commit description', command: 'jj.describe'},
      icon: 'edit',
    },
  ];
}

export function devCommits(): Commit[] {
  return [
    {
      hash: 'root_0000000000000000',
      childrenHashes: ['c1_main_111111111111'],
      shortDescription: 'root()',
      fullDescription: 'root()',
      isImmutable: true,
      active: false,
      isEmpty: true,
      bookmarkChips: [],
      displayId: 'zzzzzzzz',
      highlightedDisplayIdLen: 8,
      updateTime: now - 86400000 * 10,
      isMultiSelected: false,
      iconButtons: devIconButtons(),
    },
    {
      hash: 'c1_main_111111111111',
      childrenHashes: ['c2_auth_222222222222', 'c3_ui_333333333333'],
      shortDescription:
        'feat(core): initial Jujutsu setup with Bazel build system',
      fullDescription:
        'feat(core): initial Jujutsu setup with Bazel build system',
      isImmutable: true,
      active: false,
      isEmpty: false,
      bookmarkChips: [
        {
          left: {
            text: 'main',
            color: mainChipColor,
            codiconBefore: 'bookmark',
          },
          right: {
            chip: {
              text: 'origin/main',
              color: mainChipColor,
              codiconBefore: 'cloud',
            },
            borderColor: mainChipColor.border,
          },
          dragAndDropCommands: {
            move: {command: 'jj.bookmark.move'},
            abandon: {command: 'jj.bookmark.delete'},
          },
        },
      ],
      displayId: 'kkmxuvyq',
      highlightedDisplayIdLen: 4,
      updateTime: now - 86400000 * 5,
      isMultiSelected: false,
      iconButtons: devIconButtons(),
    },
    {
      hash: 'c2_auth_222222222222',
      childrenHashes: ['c4_wc_444444444444'],
      shortDescription: 'feat(auth): implement extension RPC channel protocol',
      fullDescription: 'feat(auth): implement extension RPC channel protocol',
      isImmutable: false,
      active: false,
      isEmpty: false,
      bookmarkChips: [
        {
          left: {
            text: 'feature/auth-rpc',
            color: featureChipColor,
            codiconBefore: 'git-branch',
          },
          dragAndDropCommands: {
            move: {command: 'jj.bookmark.move'},
            abandon: {command: 'jj.bookmark.delete'},
          },
        },
      ],
      displayId: 'rlznqpov',
      highlightedDisplayIdLen: 4,
      updateTime: now - 86400000 * 3,
      isMultiSelected: false,
      iconButtons: devIconButtons(),
    },
    {
      hash: 'c4_wc_444444444444',
      childrenHashes: [],
      shortDescription: '(no description set)',
      fullDescription: '',
      isImmutable: false,
      active: true,
      isEmpty: true,
      bookmarkChips: [
        {
          left: {
            text: '@',
            tooltip: 'Working Copy Commit',
            color: workingCopyChipColor,
            codiconBefore: 'edit',
          },
          dragAndDropCommands: {
            move: {command: 'jj.bookmark.move'},
            abandon: {command: 'jj.bookmark.delete'},
          },
        },
      ],
      displayId: 'wzuytros',
      highlightedDisplayIdLen: 3,
      updateTime: now - 3600000,
      isMultiSelected: false,
      iconButtons: devIconButtons(),
    },
    {
      hash: 'c3_ui_333333333333',
      childrenHashes: ['c5_merge_555555555555'],
      shortDescription:
        'refactor(ui): update CSS styles for commit graph components',
      fullDescription:
        'refactor(ui): update CSS styles for commit graph components',
      isImmutable: false,
      active: false,
      isEmpty: false,
      hasConflict: true,
      bookmarkChips: [
        {
          left: {
            text: 'feature/ui-styles',
            color: featureChipColor,
            codiconBefore: 'paintcan',
          },
          dragAndDropCommands: {
            move: {command: 'jj.bookmark.move'},
            abandon: {command: 'jj.bookmark.delete'},
          },
        },
      ],
      displayId: 'mnxptqws',
      highlightedDisplayIdLen: 4,
      updateTime: now - 86400000 * 2,
      isMultiSelected: false,
      iconButtons: devIconButtons(),
    },
    {
      hash: 'c6_diverged_666666666666',
      childrenHashes: ['c5_merge_555555555555'],
      shortDescription: 'fix(graph): resolve tile drawer alignment issues',
      fullDescription: 'fix(graph): resolve tile drawer alignment issues',
      isImmutable: false,
      active: false,
      isEmpty: false,
      hasDiverged: true,
      bookmarkChips: [
        {
          left: {
            text: 'fix-drawer??',
            color: {
              background: '#5a3e1b',
              foreground: '#ffc107',
              border: '#8a5c1a',
            },
            codiconBefore: 'warning',
          },
          dragAndDropCommands: {
            move: {command: 'jj.bookmark.move'},
            abandon: {command: 'jj.bookmark.delete'},
          },
        },
      ],
      displayId: 'pqrstuvw',
      highlightedDisplayIdLen: 3,
      updateTime: now - 86400000 * 1,
      isMultiSelected: false,
      iconButtons: devIconButtons(),
    },
    {
      hash: 'c5_merge_555555555555',
      childrenHashes: [],
      shortDescription: 'merge: combine ui-styles and fix-drawer branches',
      fullDescription: 'merge: combine ui-styles and fix-drawer branches',
      isImmutable: false,
      active: false,
      isEmpty: false,
      bookmarkChips: [],
      displayId: 'vbnmzxas',
      highlightedDisplayIdLen: 3,
      updateTime: now - 1800000,
      isMultiSelected: false,
      iconButtons: devIconButtons(),
    },
  ];
}
