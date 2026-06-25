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
import {ConflictCodeLensProvider} from './codelens';
import {acceptAllSides, acceptOneSide} from './commands';
import {ConflictDecorator} from './decorator';
import {ConflictTracker} from './tracker';

/**
 * Adds highlights and coloring on go/jj styled merge conflict.
 *
 * The merge conflict UI parses the text document for merge conflicts and
 * adds code lenses and decorators for them. It also registers commands for
 * accepting all or one side of a merge conflict.
 */
export function activateMergeConflict(): vscode.Disposable {
  const conflictTracker = new ConflictTracker();
  const conflictDecorator = new ConflictDecorator(conflictTracker);
  const conflictCodeLensProvider = new ConflictCodeLensProvider(
    conflictTracker,
  );
  const conflictCommands = [
    vscode.commands.registerCommand(
      'jj.mergeConflict.acceptAllSides',
      (...args: unknown[]) => {
        acceptAllSides(args);
      },
    ),
    vscode.commands.registerCommand(
      'jj.mergeConflict.acceptOneSide',
      (...args: unknown[]) => {
        acceptOneSide(args);
      },
    ),
  ];

  return vscode.Disposable.from(
    conflictTracker,
    conflictDecorator,
    conflictCodeLensProvider,
    ...conflictCommands,
  );
}
