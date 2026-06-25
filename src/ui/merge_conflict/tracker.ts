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

import {HashMap} from '../../utils/hashmap';
import * as vscode from 'vscode';
import {Conflict, parseTextDocument} from './parser';

/**
 * Event fired when the conflicts in a text editor changed.
 */
export interface ConflictEvent {
  editor: vscode.TextEditor;
  conflicts: Conflict[];
  // The version of the document when the conflict was parsed.
  // See `vscode.TextDocument.version`.
  version: number;
}

/**
 * Tracks conflicts in text editors.
 */
export class ConflictTracker implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  private readonly onDidChangeEmitter =
    new vscode.EventEmitter<ConflictEvent>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  private readonly conflictTracker = new HashMap<vscode.Uri, ConflictEvent>();

  constructor() {
    for (const editor of vscode.window.visibleTextEditors) {
      this.processEditor(editor);
    }
    this.disposables.push(
      this.onDidChangeEmitter,
      vscode.workspace.onDidChangeTextDocument(event => {
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document === event.document) {
            this.processEditor(editor);
          }
        }
      }),
      vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (const editor of editors) {
          this.processEditor(editor);
        }
      }),
    );
  }

  getConflict(uri: vscode.Uri): ConflictEvent | undefined {
    return this.conflictTracker.get(uri);
  }

  getConflicts(): ConflictEvent[] {
    const conflicts: ConflictEvent[] = [];
    for (const event of this.conflictTracker.values()) {
      if (event.conflicts.length > 0) {
        conflicts.push(event);
      }
    }
    return conflicts;
  }

  private processEditor(editor: vscode.TextEditor) {
    let event = this.conflictTracker.get(editor.document.uri);
    if (event !== undefined && event.version === editor.document.version) {
      event.editor = editor;
    } else {
      event = {
        editor,
        conflicts: parseTextDocument(editor.document),
        version: editor.document.version,
      };
      this.conflictTracker.set(editor.document.uri, event);
    }
    this.onDidChangeEmitter.fire(event);
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
