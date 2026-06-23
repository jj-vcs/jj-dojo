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

import {FakeEventEmitter} from './custom_fakes/fake_event_emitter';
import {FakeLogOutputChannel} from './custom_fakes/fake_log_output_channel';
import {createVscodeFakeImpl} from './custom_fakes/fake_vscode';
import {FakeEnvironmentVariableCollection} from './google_fakes/fake_environment_variable_collection';
import {FakeExtension} from './google_fakes/fake_extension';
import {FakeExtensionContext} from './google_fakes/fake_extension_context';
import {FakeLanguageModelAccessInformation} from './google_fakes/fake_language_model_access_information';
import {FakeMemento} from './google_fakes/fake_memento';
import {FakeSecretStorage} from './google_fakes/fake_secret_storage';

export {
  createVscodeFakeImpl,
  FakeEnvironmentVariableCollection,
  FakeEventEmitter,
  FakeExtension,
  FakeExtensionContext,
  FakeLanguageModelAccessInformation,
  FakeLogOutputChannel,
  FakeMemento,
  FakeSecretStorage,
};
