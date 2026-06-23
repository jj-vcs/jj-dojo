/**
 * Copyright 2026 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type * as vscode from 'vscode';
import {URI} from 'vscode-uri';

import * as vscodeEnums from '../../../third_party/vscode/vscode_enums';

import {FakeEventEmitter} from './fake_event_emitter';

/**
 * @returns a test-only implementation of 'vscode' based on fakes and mocks
 */
export function createVscodeFakeImpl() {
  return {
    ...vscodeEnums,
    Uri: URI,
    EventEmitter: FakeEventEmitter,
    window: {
      ...outputChannelsRegistry(),
      showInformationMessage: jasmine.createSpy('showInformationMessage'),
    },
  };
}

function outputChannelsRegistry() {
  const outputChannels = new Map<string, vscode.OutputChannel>();
  return {
    createOutputChannel: (name: string) => {
      const channel = outputChannels.get(name);
      if (channel) {
        return channel;
      }
      throw new Error(`No output channel ${name} registered in test`);
    },
    registerOutputChannel: <T extends vscode.OutputChannel>(channel: T) => {
      outputChannels.set(channel.name, channel);
    },
  };
}
