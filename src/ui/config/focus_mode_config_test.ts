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

import 'jasmine';

import {fakeVscode, installVscode} from '../../testing/install_vscode';
import {
  getFocusModeConfigCache,
  removeFocusModeConfigCache,
} from './focus_mode_config';

describe('focusModeConfigCache', () => {
  beforeEach(() => {
    installVscode();
  });

  afterEach(() => {
    removeFocusModeConfigCache();
  });

  it('returns the same singleton instance until removed', () => {
    const first = getFocusModeConfigCache();
    const second = getFocusModeConfigCache();
    expect(first).toBe(second);
  });

  it('disposes the cached instance and creates a fresh one after removeFocusModeConfigCache', () => {
    const first = getFocusModeConfigCache();
    const cb = jasmine.createSpy();
    first.onDidChangeConfiguration(cb);
    first.update(true);
    expect(first.get()).toBeTrue();
    expect(
      fakeVscode().commands.executeCommand(
        'getContext',
        'jj.isFocusModeEnabled',
      ),
    ).toBeTrue();
    cb.calls.reset();

    removeFocusModeConfigCache();

    // Disposing unsubscribes listeners on the old instance.
    void fakeVscode()
      .workspace.getConfiguration('jj')
      .update('graph.focusMode', false);
    fakeVscode().workspace.onDidChangeConfigurationEmitter.fire({
      affectsConfiguration: () => true,
    });
    expect(cb).not.toHaveBeenCalled();

    // Re-installing vscode and getting the cache creates a fresh instance bound to the new workspace.
    installVscode();
    const second = getFocusModeConfigCache();
    expect(second).not.toBe(first);
    expect(second.get()).toBeFalse();
    expect(
      fakeVscode().commands.executeCommand(
        'getContext',
        'jj.isFocusModeEnabled',
      ),
    ).toBeFalse();
  });
});
