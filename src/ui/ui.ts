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
import {activateMergeConflict} from './merge_conflict/activate';
import {CommitGraphViewProvider} from './commit_graph_provider/commit_graph_provider';
import {dispose} from '../utils/dispose';

/** The main class that contains all jj UI components. */
export class JjUi implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.disposables.push(activateMergeConflict());
    this.disposables.push(
      vscode.window.registerWebviewViewProvider(
        CommitGraphViewProvider.viewType,
        new CommitGraphViewProvider(context.extensionUri),
      ),
    );
  }

  dispose() {
    dispose(this.disposables);
  }
}
