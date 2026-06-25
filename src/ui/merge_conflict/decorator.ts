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

import * as vscode from 'vscode'; // from //third_party/vscode/src/vs:vscode
import {ConflictEvent, ConflictTracker} from './tracker';

/**
 * Decorates conflicts with colors and highlights.
 */
export class ConflictDecorator implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  private readonly beginLineDecoratorType =
    vscode.window.createTextEditorDecorationType(
      generateBlockRenderOptions(
        // Another darker coloring option is `merge.commonHeaderBackground`.
        new vscode.ThemeColor('merge.commonContentBackground'),
      ),
    );
  private readonly endLineDecoratorType =
    vscode.window.createTextEditorDecorationType(
      generateBlockRenderOptions(
        new vscode.ThemeColor('merge.commonContentBackground'),
      ),
    );
  private readonly sideDecoratorTypes = [
    vscode.window.createTextEditorDecorationType(
      generateBlockRenderOptions(
        new vscode.ThemeColor('merge.currentContentBackground'),
      ),
    ),
    vscode.window.createTextEditorDecorationType(
      generateBlockRenderOptions(
        new vscode.ThemeColor('merge.incomingContentBackground'),
      ),
    ),
    vscode.window.createTextEditorDecorationType(
      generateBlockRenderOptions(
        new vscode.ThemeColor('jj.mergeConflict.thirdSideBackground'),
      ),
    ),
    // We only support showing up to 3 sides of conflicts with different colors.
    // After that, we cycle through the coloring styles.
  ];

  constructor(tracker: ConflictTracker) {
    for (const event of tracker.getConflicts()) {
      this.applyDecorations(event);
    }
    this.disposables.push(
      tracker.onDidChange(event => {
        this.applyDecorations(event);
      }),
    );
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }

  private applyDecorations(event: ConflictEvent) {
    const {editor, conflicts} = event;

    const beginLines: vscode.Range[] = [];
    const endLines: vscode.Range[] = [];
    const sides: vscode.Range[][] = this.sideDecoratorTypes.map(() => []);

    for (const conflict of conflicts) {
      beginLines.push(conflict.beginLine);
      endLines.push(conflict.endLine);
      for (let i = 0; i < conflict.sides.length; ++i) {
        const range = conflict.sides[i].range;
        // There are `this.sideDecoratorTypes.length` coloring styles.
        // When there are more sides of conflicts than that, cycle through the
        // coloring styles.
        sides[i % this.sideDecoratorTypes.length].push(range);
      }
    }
    editor.setDecorations(this.beginLineDecoratorType, beginLines);
    editor.setDecorations(this.endLineDecoratorType, endLines);
    for (let i = 0; i < this.sideDecoratorTypes.length; i++) {
      editor.setDecorations(this.sideDecoratorTypes[i], sides[i]);
    }
  }
}

function generateBlockRenderOptions(
  backgroundColor: string | vscode.ThemeColor,
): vscode.DecorationRenderOptions {
  const renderOptions: vscode.DecorationRenderOptions = {};
  renderOptions.backgroundColor = backgroundColor;
  renderOptions.isWholeLine = true;
  return renderOptions;
}
