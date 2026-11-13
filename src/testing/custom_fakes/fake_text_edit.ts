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

import type * as vscode from 'vscode';
import {FakePosition} from './fake_position';
import {FakeRange} from './fake_range';

export class FakeTextEdit implements vscode.TextEdit {
  newEol?: vscode.EndOfLine;

  constructor(
    public range: vscode.Range,
    public newText: string,
  ) {}

  static replace(range: vscode.Range, newText: string): FakeTextEdit {
    return new FakeTextEdit(range, newText);
  }

  static insert(position: vscode.Position, newText: string): FakeTextEdit {
    return new FakeTextEdit(new FakeRange(position, position), newText);
  }

  static delete(range: vscode.Range): FakeTextEdit {
    return new FakeTextEdit(range, '');
  }

  static setEndOfLine(eol: vscode.EndOfLine): FakeTextEdit {
    const edit = new FakeTextEdit(
      new FakeRange(new FakePosition(0, 0), new FakePosition(0, 0)),
      '',
    );
    edit.newEol = eol;
    return edit;
  }
}
