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
import {fakeVscode, installVscode} from '../../testing/install_vscode';

import {ConflictDecorator} from './decorator';
import {ConflictTracker} from './tracker';

describe('Decorator', () => {
  beforeEach(installVscode);

  function setup() {
    const document = new FakeTextDocument();
    const editor = new FakeTextEditor(document);
    spyOn(editor, 'setDecorations');
    vscode.window.visibleTextEditors = [editor];
    return {
      document,
      editor,
    };
  }

  it('does not call setDecorations when there are no conflicts', () => {
    const {editor} = setup();
    const tracker = new ConflictTracker();
    const decorator = new ConflictDecorator(tracker);
    expect(editor.setDecorations).toHaveBeenCalledTimes(0);
    // Use it so ts-lint doesn't complain about unused variables.
    decorator.dispose();
  });

  it('applies decorations on currently opened editors', () => {
    const {document, editor} = setup();
    document.text = textWithConflict;
    const tracker = new ConflictTracker();
    const decorator = new ConflictDecorator(tracker);

    // It should be called 5 times:
    // Once for beginLineDecoratorType,
    // Once for endLineDecoratorType,
    // Three times for sideDecoratorTypes.
    expect(editor.setDecorations).toHaveBeenCalledTimes(5);

    decorator.dispose();
  });

  it('applies decorations on changes to opened editors', async () => {
    const {document, editor} = setup();

    const tracker = new ConflictTracker();
    const decorator = new ConflictDecorator(tracker);
    expect(editor.setDecorations).toHaveBeenCalledTimes(0);

    document.text = textWithConflict;

    fakeVscode().workspace.onDidChangeTextDocumentEmitter.fire(
      fakeTextDocumentChangeEvent(document),
    );

    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(editor.setDecorations).toHaveBeenCalledTimes(5);
    decorator.dispose();
  });
});

const textWithConflict = `<<<<<<< conflict 1 of 1
%%%%%%% diff from: base_change_id base_commit_id
\\\\\\\\\\\\\\        to: change_id_1 commit_id_1
 apple
+grapefruit
+++++++ change_id_2 commit_id_2
APPLE
GRAPE
>>>>>>> conflict 1 of 1 ends`;

function fakeTextDocumentChangeEvent(
  document: vscode.TextDocument,
): vscode.TextDocumentChangeEvent {
  return {
    contentChanges: [],
    document,
    reason: undefined,
  };
}
