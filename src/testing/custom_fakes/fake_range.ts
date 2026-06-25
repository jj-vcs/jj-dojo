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

import type * as vscode from 'vscode';
import {unimplemented} from './unimplemented';
import {FakePosition} from './fake_position';

export class FakeRange implements vscode.Range {
  readonly start: vscode.Position;
  readonly end: vscode.Position;

  get isEmpty(): boolean {
    return unimplemented(this.constructor.name, 'isEmpty');
  }

  get isSingleLine(): boolean {
    return unimplemented(this.constructor.name, 'isSingleLine');
  }

  constructor(start: vscode.Position, end: vscode.Position);
  constructor(
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
  );
  constructor(
    startLineOrStart: number | vscode.Position,
    startColumnOrEnd: number | vscode.Position,
    endLine?: number,
    endColumn?: number,
  ) {
    if (
      typeof startLineOrStart === 'number' &&
      typeof startColumnOrEnd === 'number' &&
      typeof endLine === 'number' &&
      typeof endColumn === 'number'
    ) {
      this.start = new FakePosition(startLineOrStart, startColumnOrEnd);
      this.end = new FakePosition(endLine, endColumn);
    } else if (
      typeof startLineOrStart !== 'number' &&
      typeof startColumnOrEnd !== 'number'
    ) {
      this.start = startLineOrStart;
      this.end = startColumnOrEnd;
    } else {
      throw new Error('Invalid arguments');
    }
  }

  contains(_positionOrRange: vscode.Position | vscode.Range): boolean {
    return unimplemented(this.constructor.name, 'contains');
  }

  isEqual(_other: vscode.Range): boolean {
    return unimplemented(this.constructor.name, 'isEqual');
  }

  intersection(_other: vscode.Range): vscode.Range | undefined {
    return unimplemented(this.constructor.name, 'intersection');
  }

  union(_other: vscode.Range): vscode.Range {
    return unimplemented(this.constructor.name, 'union');
  }

  with(_change: {start?: vscode.Position; end?: vscode.Position}): vscode.Range;
  with(_start?: vscode.Position, _end?: vscode.Position): vscode.Range;
  with(
    _startOrChange?:
      | vscode.Position
      | {start?: vscode.Position; end?: vscode.Position},
    _end?: vscode.Position,
  ): vscode.Range {
    return unimplemented(this.constructor.name, 'with');
  }
}
