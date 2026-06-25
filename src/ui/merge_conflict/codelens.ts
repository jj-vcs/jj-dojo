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

import * as vscode from 'vscode';
import {ConflictTracker} from './tracker';

/**
 * Provides 'Accept all sides' and 'Accept side #X' code lenses for jj-styled
 * conflict markers.
 *
 * VSCode has a builtin merge-conflict extension that provides codelens like
 * 'Accept Current Change', 'Accept Incoming Change' for git-styled conflict
 * markers. See https://code.visualstudio.com/docs/sourcecontrol/overview#_merge-conflicts
 *
 * This class provides similar functionality for jj-styled conflict markers.
 */
export class ConflictCodeLensProvider implements vscode.CodeLensProvider {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly tracker: ConflictTracker) {
    vscode.languages.registerCodeLensProvider(
      [
        {scheme: 'file'},
        {scheme: 'vscode-vfs'},
        {scheme: 'untitled'},
        {scheme: 'vscode-userdata'},
      ],
      this,
    );
  }

  /**
   * Returns a list of 'Accept all sides' and 'Accept side #X' code lenses for
   * the given document. As documented in the vscode.CodeLensProvider interface,
   * this method should return as fast as possible, and should avoid expensive
   * computations. See the interface for details.
   */
  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): Promise<vscode.CodeLens[] | null> {
    const conflictEvent = this.tracker.getConflict(document.uri);
    if (conflictEvent === undefined) {
      return null;
    }

    const codeLenses: vscode.CodeLens[] = [];
    for (const conflict of conflictEvent.conflicts) {
      codeLenses.push(
        new vscode.CodeLens(conflict.beginLine, {
          title: 'Accept all sides',
          command: 'jj.mergeConflict.acceptAllSides',
          arguments: [conflict],
          tooltip: 'Accept all sides',
        }),
      );
      for (let i = 0; i < conflict.sides.length; i++) {
        const {range} = conflict.sides[i];
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: 'Accept this side',
            command: 'jj.mergeConflict.acceptOneSide',
            arguments: [conflict, i],
            tooltip: 'Accept this side',
          }),
        );
      }
    }
    return Promise.resolve(codeLenses);
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
