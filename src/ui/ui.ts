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

/** The JJ UI elements shared between external and internal. */
export class JjUiBase implements vscode.Disposable {
  protected readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(activateMergeConflict());
  }

  dispose() {
    dispose(this.disposables);
  }
}

/** Contains all jj ui elements, including those that are only used externally. */
export class JjUi extends JjUiBase {
  constructor(context: vscode.ExtensionContext) {
    super();
    this.disposables.push(
      vscode.window.registerWebviewViewProvider(
        CommitGraphViewProvider.viewType,
        new CommitGraphViewProvider(context.extensionUri),
      ),
    );
  }
}
