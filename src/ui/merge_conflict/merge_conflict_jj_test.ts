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

/// <reference types="node" />

import * as fs from 'fs';
import * as path from 'path';
import 'jasmine';
import * as vscode from 'vscode';
import {SubprocessClient} from '../../client/subprocess_client';
import {FakeTextDocument, FakeTextEditor} from '../../testing/fakes';
import {installVscode} from '../../testing/install_vscode';
import {newRepo} from '../../testing/new_repo';
import {activateMergeConflict} from './activate';
import {acceptAllSides, acceptOneSide} from './commands';
import {parseTextDocument} from './parser';
import {getResolvedText, getResolvedTextForAllSides} from './resolver';

const decode = (bytes: Uint8Array | undefined) =>
  new TextDecoder('utf-8').decode(bytes);

describe('MergeConflict components against real jj CLI', () => {
  const {jj, repo, writeFile, getWcChangeId} = newRepo();

  beforeEach(() => {
    installVscode();
  });

  async function setupTwoSidedConflict(fileName = 'conflict.txt') {
    writeFile(fileName, 'apple\ngrape\norange\n');
    await jj('describe', '-m', 'base commit');
    const baseChangeId = await getWcChangeId();

    await jj('new', baseChangeId, '-m', 'side 1 commit');
    writeFile(fileName, 'apple\ngrapefruit\norange\n');
    const side1ChangeId = await getWcChangeId();

    await jj('new', baseChangeId, '-m', 'side 2 commit');
    writeFile(fileName, 'APPLE\nGRAPE\nORANGE\n');
    const side2ChangeId = await getWcChangeId();

    await jj('new', side1ChangeId, side2ChangeId, '-m', 'merge commit');
    const filePath = path.join(repo.workspaceRoot, fileName);
    const diskText = fs.readFileSync(filePath, 'utf-8');
    return {
      fileName,
      filePath,
      diskText,
      side1ChangeId,
      side2ChangeId,
    };
  }

  it('parses, decorates, provides CodeLenses, and resolves side #0 (%%%%%%% diff block) of a real 2-sided jj conflict', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    const {fileName, filePath, diskText, side1ChangeId, side2ChangeId} =
      await setupTwoSidedConflict();

    const initialState = await client.getWorkspaceState();
    const initialWc = initialState.commits.find((c) => c.active)!;
    expect(initialWc.hasConflict).toBeTrue();

    const document = new FakeTextDocument({
      uri: vscode.Uri.file(filePath),
      text: diskText,
    });
    const editor = new FakeTextEditor(document);
    spyOn(editor, 'setDecorations');
    vscode.window.visibleTextEditors = [editor];
    vscode.window.activeTextEditor = editor;

    const activationDisposable = activateMergeConflict();

    try {
      const conflicts = parseTextDocument(document);
      expect(conflicts.length).toBe(1);
      const conflict = conflicts[0];
      expect(conflict.sides.length).toBe(2);
      expect(side1ChangeId.startsWith(conflict.sides[0].changeId)).toBeTrue();
      expect(side2ChangeId.startsWith(conflict.sides[1].changeId)).toBeTrue();

      expect(editor.setDecorations).toHaveBeenCalledTimes(5);

      const registerCodeLensSpy = vscode.languages
        .registerCodeLensProvider as unknown as jasmine.Spy;
      expect(registerCodeLensSpy).toHaveBeenCalledTimes(1);
      const codeLensProvider = registerCodeLensSpy.calls.mostRecent()
        .args[1] as vscode.CodeLensProvider;

      const lenses = await codeLensProvider.provideCodeLenses(
        document,
        new vscode.CancellationTokenSource().token,
      );
      expect(lenses).not.toBeNull();
      expect(lenses!.length).toBe(3);
      expect(lenses![0].command?.command).toBe(
        'jj.mergeConflict.acceptAllSides',
      );
      expect(lenses![1].command?.command).toBe(
        'jj.mergeConflict.acceptOneSide',
      );
      expect(lenses![2].command?.command).toBe(
        'jj.mergeConflict.acceptOneSide',
      );

      await vscode.commands.executeCommand(
        'jj.mergeConflict.acceptOneSide',
        conflict,
        0,
      );
      expect(document.getText()).toBe('apple\ngrapefruit\norange\n');

      writeFile(fileName, document.getText());
      const resolvedState = await client.getWorkspaceState();
      const resolvedWc = resolvedState.commits.find((c) => c.active)!;
      expect(resolvedWc.hasConflict).toBeFalse();
      expect(
        decode(
          await client.readFileAtCommit(
            resolvedWc.id,
            resolvedState.opHead,
            fileName,
            {showParent: false},
          ),
        ),
      ).toBe('apple\ngrapefruit\norange\n');
    } finally {
      activationDisposable.dispose();
    }
  });

  it('resolves side #1 (+++++++ snapshot block) of a real 2-sided jj conflict and clears conflict in jj', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    const {fileName, filePath, diskText} = await setupTwoSidedConflict();

    const document = new FakeTextDocument({
      uri: vscode.Uri.file(filePath),
      text: diskText,
    });
    const editor = new FakeTextEditor(document);
    vscode.window.activeTextEditor = editor;

    const conflicts = parseTextDocument(document);
    expect(conflicts.length).toBe(1);
    acceptOneSide([conflicts[0], 1]);
    expect(document.getText()).toBe('APPLE\nGRAPE\nORANGE\n');

    writeFile(fileName, document.getText());
    const resolvedState = await client.getWorkspaceState();
    const resolvedWc = resolvedState.commits.find((c) => c.active)!;
    expect(resolvedWc.hasConflict).toBeFalse();
    expect(
      decode(
        await client.readFileAtCommit(
          resolvedWc.id,
          resolvedState.opHead,
          fileName,
          {showParent: false},
        ),
      ),
    ).toBe('APPLE\nGRAPE\nORANGE\n');
  });

  it('resolves all sides of a real 2-sided jj conflict via acceptAllSides and clears conflict in jj', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    const {fileName, filePath, diskText} = await setupTwoSidedConflict();

    const document = new FakeTextDocument({
      uri: vscode.Uri.file(filePath),
      text: diskText,
    });
    const editor = new FakeTextEditor(document);
    vscode.window.activeTextEditor = editor;

    const conflicts = parseTextDocument(document);
    expect(conflicts.length).toBe(1);
    acceptAllSides([conflicts[0]]);
    expect(document.getText()).toBe(
      'apple\ngrapefruit\norange\nAPPLE\nGRAPE\nORANGE\n',
    );

    writeFile(fileName, document.getText());
    const resolvedState = await client.getWorkspaceState();
    const resolvedWc = resolvedState.commits.find((c) => c.active)!;
    expect(resolvedWc.hasConflict).toBeFalse();
  });

  it('parses and resolves a 3-sided octopus conflict materialized by real jj CLI (two %%%%%%% diff blocks and one +++++++ block)', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    const fileName = 'octopus.txt';
    writeFile(fileName, 'apple\ngrape\norange\n');
    await jj('describe', '-m', 'base commit');
    const baseChangeId = await getWcChangeId();

    await jj('new', baseChangeId, '-m', 'side 1');
    writeFile(fileName, 'apple\ngrapefruit\norange\n');
    const side1ChangeId = await getWcChangeId();

    await jj('new', baseChangeId, '-m', 'side 2');
    writeFile(fileName, 'APPLE\nGRAPE\nORANGE\n');
    const side2ChangeId = await getWcChangeId();

    // Side 3 intentionally leaves description empty to test header without quoted message
    await jj('new', baseChangeId);
    writeFile(fileName, 'Apple\nGrape\nOrange\n');
    const side3ChangeId = await getWcChangeId();

    await jj('new', side1ChangeId, side2ChangeId, side3ChangeId);

    const filePath = path.join(repo.workspaceRoot, fileName);
    const diskText = fs.readFileSync(filePath, 'utf-8');
    // Real jj 3-way merge outputs two `%%%%%%% diff from:` blocks and one `+++++++` block
    expect(diskText.match(/^%%%%%%% diff from:/gm)?.length).toBe(2);
    expect(diskText.match(/^\+\+\+\+\+\+\+/gm)?.length).toBe(1);

    const document = new FakeTextDocument({
      uri: vscode.Uri.file(filePath),
      text: diskText,
    });
    const editor = new FakeTextEditor(document);
    vscode.window.activeTextEditor = editor;

    const conflicts = parseTextDocument(document);
    expect(conflicts.length).toBe(1);
    const conflict = conflicts[0];
    expect(conflict.sides.length).toBe(3);
    expect(side1ChangeId.startsWith(conflict.sides[0].changeId)).toBeTrue();
    expect(side2ChangeId.startsWith(conflict.sides[1].changeId)).toBeTrue();
    expect(side3ChangeId.startsWith(conflict.sides[2].changeId)).toBeTrue();

    // Verify each side resolves cleanly without bleeding `%%%%%%%` headers across adjacent diff blocks
    expect(getResolvedText(document.getText(conflict.sides[0].range))).toBe(
      'apple\ngrapefruit\norange',
    );
    expect(getResolvedText(document.getText(conflict.sides[1].range))).toBe(
      'APPLE\nGRAPE\nORANGE',
    );
    expect(getResolvedText(document.getText(conflict.sides[2].range))).toBe(
      'Apple\nGrape\nOrange',
    );
    expect(
      getResolvedTextForAllSides(
        conflict.sides.map((s) => document.getText(s.range)),
      ),
    ).toBe(
      'apple\ngrapefruit\norange\nAPPLE\nGRAPE\nORANGE\nApple\nGrape\nOrange',
    );

    // Accept the second `%%%%%%%` diff side (side #1) and verify jj marks conflict resolved
    acceptOneSide([conflict, 1]);
    writeFile(fileName, document.getText());
    const resolvedState = await client.getWorkspaceState();
    const resolvedWc = resolvedState.commits.find((c) => c.active)!;
    expect(resolvedWc.hasConflict).toBeFalse();
    expect(
      decode(
        await client.readFileAtCommit(
          resolvedWc.id,
          resolvedState.opHead,
          fileName,
          {showParent: false},
        ),
      ),
    ).toBe('APPLE\nGRAPE\nORANGE\n');
  });

  it('parses and resolves multi-hunk conflicts with quotes, parentheses, and (no terminating newline) annotations', async () => {
    const client = new SubprocessClient(repo.workspaceRoot);
    const fileName = 'multi_hunk.txt';
    writeFile(
      fileName,
      'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\n',
    );
    await jj('describe', '-m', 'base "quoted" (parens)');
    const baseChangeId = await getWcChangeId();

    await jj('new', baseChangeId, '-m', 'side 1 "quoted" (parens)');
    writeFile(
      fileName,
      'line1-side1\nline2\nline3\nline4\nline5\nline6\nline7\nline8-side1',
    );
    const side1ChangeId = await getWcChangeId();

    await jj('new', baseChangeId, '-m', 'side 2 (parens)');
    writeFile(
      fileName,
      'line1-side2\nline2\nline3\nline4\nline5\nline6\nline7\nline8-side2',
    );
    const side2ChangeId = await getWcChangeId();

    await jj('new', side1ChangeId, side2ChangeId);

    const filePath = path.join(repo.workspaceRoot, fileName);
    const diskText = fs.readFileSync(filePath, 'utf-8');
    expect(diskText).toContain('(no terminating newline)');

    const document = new FakeTextDocument({
      uri: vscode.Uri.file(filePath),
      text: diskText,
    });
    const editor = new FakeTextEditor(document);
    vscode.window.activeTextEditor = editor;

    const conflicts = parseTextDocument(document);
    expect(conflicts.length).toBe(2);
    expect(side1ChangeId.startsWith(conflicts[0].sides[0].changeId)).toBeTrue();
    expect(side2ChangeId.startsWith(conflicts[0].sides[1].changeId)).toBeTrue();
    expect(side1ChangeId.startsWith(conflicts[1].sides[0].changeId)).toBeTrue();
    expect(side2ChangeId.startsWith(conflicts[1].sides[1].changeId)).toBeTrue();

    // Resolve bottom conflict first, then re-parse and resolve top conflict
    acceptOneSide([conflicts[1], 0]);
    const remainingConflicts = parseTextDocument(document);
    expect(remainingConflicts.length).toBe(1);
    acceptOneSide([remainingConflicts[0], 1]);

    writeFile(fileName, document.getText());
    const resolvedState = await client.getWorkspaceState();
    const resolvedWc = resolvedState.commits.find((c) => c.active)!;
    expect(resolvedWc.hasConflict).toBeFalse();
    expect(
      decode(
        await client.readFileAtCommit(
          resolvedWc.id,
          resolvedState.opHead,
          fileName,
          {showParent: false},
        ),
      ),
    ).toBe(
      'line1-side2\nline2\nline3\nline4\nline5\nline6\nline7\nline8-side1',
    );
  });
});
