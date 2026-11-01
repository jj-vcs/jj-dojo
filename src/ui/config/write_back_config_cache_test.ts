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
import {WriteBackConfigCache} from './write_back_config_cache';

describe('WriteBackConfigCache', () => {
  const event = {
    affectsConfiguration: () => true,
  };

  function getPersisted() {
    return fakeVscode().workspace.getConfiguration('jj').get('graph.focusMode');
  }

  function updatePersisted(value: boolean) {
    void fakeVscode()
      .workspace.getConfiguration('jj')
      .update('graph.focusMode', value);
  }

  function getContext() {
    return fakeVscode().commands.executeCommand(
      'getContext',
      'jj.isFocusModeEnabled',
    );
  }

  let focusMode: WriteBackConfigCache;
  let cb: jasmine.Spy;

  beforeEach(() => {
    installVscode();
    focusMode = new WriteBackConfigCache(
      'jj.graph.focusMode',
      false,
      'jj.isFocusModeEnabled',
    );
    cb = jasmine.createSpy();
    focusMode.onDidChangeConfiguration(cb);
  });

  afterEach(() => {
    focusMode.dispose();
  });

  it('updates the config value, and Cider successfully persists it', () => {
    expect(getContext()).toBeFalse();
    expect(focusMode.get()).toBeFalse();

    focusMode.update(true);
    expect(getContext()).toBeTrue();
    expect(focusMode.get()).toBeTrue();
    expect(getPersisted()).toBeTrue();
    expect(cb).toHaveBeenCalledOnceWith(true);
    cb.calls.reset();

    // Signal that Cider has persisted the config change.
    fakeVscode().workspace.onDidChangeConfigurationEmitter.fire(event);
    expect(getContext()).toBeTrue();
    expect(cb).not.toHaveBeenCalled();
    expect(focusMode.get()).toBeTrue();

    // Subsequent external config changes in settings are published directly.
    updatePersisted(false);
    fakeVscode().workspace.onDidChangeConfigurationEmitter.fire(event);
    expect(getContext()).toBeFalse();
    expect(cb).toHaveBeenCalledOnceWith(false);
    expect(focusMode.get()).toBeFalse();
  });

  it('updates the config value to true, and initially Cider fails to persist it', () => {
    expect(getContext()).toBeFalse();
    expect(focusMode.get()).toBeFalse();

    focusMode.update(true);
    expect(getContext()).toBeTrue();
    expect(focusMode.get()).toBeTrue();
    expect(getPersisted()).toBeTrue();
    expect(cb).toHaveBeenCalledOnceWith(true);
    cb.calls.reset();

    // Set it back to false to show Cider fails to persist it.
    updatePersisted(false);
    fakeVscode().workspace.onDidChangeConfigurationEmitter.fire(event);
    expect(getContext()).toBeTrue();
    expect(cb).not.toHaveBeenCalled();
    cb.calls.reset();

    // Stays at the last cached value.
    expect(focusMode.get()).toBeTrue();

    // Cider now successfully updated the config.
    updatePersisted(true);
    fakeVscode().workspace.onDidChangeConfigurationEmitter.fire(event);
    expect(getContext()).toBeTrue();
    expect(cb).not.toHaveBeenCalled();
    expect(focusMode.get()).toBeTrue();

    // Subsequent external config changes in settings are published directly.
    updatePersisted(false);
    fakeVscode().workspace.onDidChangeConfigurationEmitter.fire(event);
    expect(getContext()).toBeFalse();
    expect(cb).toHaveBeenCalledOnceWith(false);
    expect(focusMode.get()).toBeFalse();
  });

  it('unsubscribes listeners when disposed', () => {
    focusMode.dispose();

    updatePersisted(true);
    fakeVscode().workspace.onDidChangeConfigurationEmitter.fire(event);
    expect(getContext()).toBeFalse();
    expect(cb).not.toHaveBeenCalled();

    focusMode.update(true);
    expect(cb).not.toHaveBeenCalled();
  });
});
