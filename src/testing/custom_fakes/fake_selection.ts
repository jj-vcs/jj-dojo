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
import {FakeRange} from './fake_range';
import {FakePosition} from './fake_position';

export class FakeSelection extends FakeRange implements vscode.Selection {
  readonly anchor: vscode.Position;
  readonly active: vscode.Position;

  get isReversed(): boolean {
    return unimplemented(this.constructor.name, 'isReversed');
  }

  constructor(anchor: vscode.Position, active: vscode.Position);
  constructor(
    anchorLine: number,
    anchorColumn: number,
    activeLine: number,
    activeColumn: number,
  );
  constructor(
    anchorLineOrAnchor: number | vscode.Position,
    anchorColumnOrActive: number | vscode.Position,
    activeLine?: number,
    activeColumn?: number,
  ) {
    let anchor: vscode.Position;
    let active: vscode.Position;

    if (
      typeof anchorLineOrAnchor === 'number' &&
      typeof anchorColumnOrActive === 'number' &&
      typeof activeLine === 'number' &&
      typeof activeColumn === 'number'
    ) {
      anchor = new FakePosition(anchorLineOrAnchor, anchorColumnOrActive);
      active = new FakePosition(activeLine, activeColumn);
    } else if (
      typeof anchorLineOrAnchor !== 'number' &&
      typeof anchorColumnOrActive !== 'number'
    ) {
      anchor = anchorLineOrAnchor;
      active = anchorColumnOrActive;
    } else {
      throw new Error('Invalid arguments');
    }

    super(anchor, active);
    this.anchor = anchor;
    this.active = active;
  }
}
