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

import {FakeTextDocument} from '../../testing/fakes';
import 'jasmine';
import {installVscode} from '../../testing/install_vscode';
import {parseTextDocument} from './parser';
import {getResolvedText, getResolvedTextForAllSides} from './resolver';

describe('getResolvedText', () => {
  beforeEach(installVscode);

  it('removes metadata characters when first line starts with %%%%%%%', () => {
    expect(
      getResolvedText(`%%%%%%% diff from: base_change_id base_commit_id
\\\\\\\\\\\\\\        to: change_id_1 commit_id_1
 apple
-grape
+grapefruit
 orange`),
    ).toEqual(`apple
grapefruit
orange`);
  });

  it('ignores metadata characters when first line starts with +++++++', () => {
    expect(
      getResolvedText(`+++++++ change_id_1 commit_id_1
 apple
-grape
+grapefruit
 orange`),
    ).toEqual(` apple
-grape
+grapefruit
 orange`);
  });

  it('resolves conflict correctly when metadata characters are manually removed', () => {
    // The starting empty space character before 'apple' is removed.
    expect(
      getResolvedText(`%%%%%%% diff from:
\\\\\\\\\\\\\\        to: change_id_1 commit_id_1
apple
-grape
+grapefruit
 orange`),
    ).toEqual(`apple
-grape
+grapefruit
 orange`);
  });
});

describe('getResolvedTextForAllSides', () => {
  beforeEach(installVscode);
  function acceptAllSides(unresolvedText: string): string {
    const document = new FakeTextDocument({text: unresolvedText});
    const conflicts = parseTextDocument(document);
    expect(conflicts.length).toEqual(1);
    const conflict = conflicts[0];
    return getResolvedTextForAllSides(
      conflict.sides.map(side => document.getText(side.range)),
    );
  }

  it('both sides are not empty', () => {
    expect(
      acceptAllSides(`<<<<<<< conflict 1 of 1
%%%%%%% diff from: base_change_id base_commit_id_change_id base_commit_id
\\\\\\\\\\\\\\        to: change_id_1 commit_id_1
 apple
-grape
+++++++ change_id_2 commit_id_2
GRAPE
>>>>>>> conflict 1 of 1 ends
`),
    ).toEqual('apple\nGRAPE');
  });

  it('first side is empty and second side is not empty', () => {
    expect(
      acceptAllSides(`<<<<<<< conflict 1 of 1
%%%%%%% diff from: base_change_id base_commit_id_change_id base_commit_id
\\\\\\\\\\\\\\        to: change_id_1 commit_id_1
 apple
-grape
+++++++ change_id_2 commit_id_2
>>>>>>> conflict 1 of 1 ends
`),
    ).toEqual('apple');
  });

  it('first side is not empty and second side is empty', () => {
    expect(
      acceptAllSides(`<<<<<<< conflict 1 of 1
%%%%%%% diff from: base_change_id base_commit_id
\\\\\\\\\\\\\\        to: change_id_1 commit_id_1
-grape
+++++++ change_id_2 commit_id_2
GRAPE
>>>>>>> conflict 1 of 1 ends`),
    ).toEqual('GRAPE');
  });

  it('both sides are empty', () => {
    expect(
      acceptAllSides(`<<<<<<< conflict 1 of 1
%%%%%%% diff from: base_change_id base_commit_id
\\\\\\\\\\\\\\        to: change_id_1 commit_id_1
-grape
+++++++ change_id_2 commit_id_2
>>>>>>> conflict 1 of 1 ends`),
    ).toEqual('');
  });
});
