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

import 'jasmine';
import * as vscode from 'vscode';
import {FakeTextDocument, FakeTextEditor} from '../../testing/fakes';
import {installVscode} from '../../testing/install_vscode';
import {ConflictCodeLensProvider} from './codelens';
import {Conflict} from './parser';
import {ConflictTracker} from './tracker';

describe('ConflictCodeLensProvider', () => {
  beforeEach(installVscode);

  it('provides code lenses when there is a conflict', async () => {
    const tracker = new ConflictTracker();
    const provider = new ConflictCodeLensProvider(tracker);
    const document = new FakeTextDocument({uri: vscode.Uri.file('file.txt')});
    const editor = new FakeTextEditor(document);
    const conflict: Conflict = {
      beginLine: new vscode.Range(
        new vscode.Position(1, 2),
        new vscode.Position(3, 4),
      ),
      sides: [
        {
          changeId: 'change_id_1',
          range: new vscode.Range(
            new vscode.Position(5, 6),
            new vscode.Position(7, 8),
          ),
        },
        {
          changeId: 'change_id_2',
          range: new vscode.Range(
            new vscode.Position(9, 10),
            new vscode.Position(11, 12),
          ),
        },
      ],
      endLine: new vscode.Range(
        new vscode.Position(13, 14),
        new vscode.Position(15, 16),
      ),
    };
    spyOn(tracker, 'getConflict').and.returnValue({
      editor,
      conflicts: [conflict],
      version: 0,
    });

    const codelens = await provider.provideCodeLenses(
      document,
      new vscode.CancellationTokenSource().token,
    );
    expect(codelens).not.toBeNull();
    expect(codelens).toHaveSize(3);
    expect(codelens![0]).toEqual(
      new vscode.CodeLens(conflict.beginLine, {
        title: 'Accept all sides',
        command: 'jj.mergeConflict.acceptAllSides',
        arguments: [conflict],
        tooltip: 'Accept all sides',
      }),
    );
    expect(codelens![1]).toEqual(
      new vscode.CodeLens(conflict.sides[0].range, {
        title: 'Accept this side',
        command: 'jj.mergeConflict.acceptOneSide',
        arguments: [conflict, 0],
        tooltip: 'Accept this side',
      }),
    );
    expect(codelens![2]).toEqual(
      new vscode.CodeLens(conflict.sides[1].range, {
        title: 'Accept this side',
        command: 'jj.mergeConflict.acceptOneSide',
        arguments: [conflict, 1],
        tooltip: 'Accept this side',
      }),
    );
  });

  it('does nothing when there is no conflict', async () => {
    const tracker = new ConflictTracker();
    const provider = new ConflictCodeLensProvider(tracker);
    spyOn(tracker, 'getConflict').and.returnValue(undefined);
    await expectAsync(
      provider.provideCodeLenses(
        new FakeTextDocument({uri: vscode.Uri.file('file.txt')}),
        new vscode.CancellationTokenSource().token,
      ),
    ).toBeResolvedTo(null);
  });
});
