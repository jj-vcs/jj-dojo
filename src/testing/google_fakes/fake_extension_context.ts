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

import * as vscode from 'vscode'; // from //third_party/vscode/src/vs:vscode

import {FakeGlobalEnvironmentVariableCollection} from './fake_environment_variable_collection';
import {FakeExtension} from './fake_extension';
import {FakeLanguageModelAccessInformation} from './fake_language_model_access_information';
import {FakeMemento} from './fake_memento';
import {FakeSecretStorage} from './fake_secret_storage';

/**
 * Fake implementation of vscode.ExtensionContext that can be passed to
 * extensions' activate method.
 *
 * For the real implementation see:
 * google3/third_party/vscode/src/vs/workbench/api/common/extHostExtensionService.ts
 */
export class FakeExtensionContext implements vscode.ExtensionContext {
  extension = new FakeExtension();
  get extensionId(): string {
    return this.extension.id;
  }
  get extensionUri(): vscode.Uri {
    return this.extension.extensionUri;
  }
  get extensionPath(): string {
    return this.extensionUri.fsPath;
  }

  storageUri: vscode.Uri | undefined = undefined;
  get storagePath(): string | undefined {
    return this.storageUri?.fsPath;
  }

  globalStorageUri = vscode.Uri.parse('fake://authority/global/storage');
  get globalStoragePath(): string {
    return this.globalStorageUri.fsPath;
  }

  logUri = vscode.Uri.parse('fake://authority/log');
  get logPath(): string {
    return this.logUri.fsPath;
  }

  asAbsolutePath(relativePath: string): string {
    return vscode.Uri.joinPath(this.extensionUri, relativePath).toString(false);
  }

  extensionMode = vscode.ExtensionMode.Test;
  // NOTE: Commented out since this is a vscode proposed api
  // extensionRuntime = vscode.ExtensionRuntime.Webworker;

  subscriptions: vscode.Disposable[] = [];

  workspaceState = new FakeMemento();
  globalState = new FakeMemento();
  environmentVariableCollection = new FakeGlobalEnvironmentVariableCollection();
  secrets: vscode.SecretStorage = new FakeSecretStorage();

  isNewInstall = false;
  languageModelAccessInformation = new FakeLanguageModelAccessInformation();
  extensionVersion = '';
  // NOTE: Commented out since this is a vscode proposed api
  // readonly messagePassingProtocol: vscode.MessagePassingProtocol | undefined;

  constructor({
    extensionVersion,
    storageUri,
    globalStorageUri,
    logUri,
    extensionMode,
    // NOTE: Commented out since this is a vscode proposed api
    // extensionRuntime,
    isNewInstall,
    languageModelAccessInformation,
  }: {
    extensionVersion?: string;
    storageUri?: vscode.Uri;
    globalStorageUri?: vscode.Uri;
    logUri?: vscode.Uri;
    extensionMode?: vscode.ExtensionMode;
    // NOTE: Commented out since this is a vscode proposed api
    // extensionRuntime?: vscode.ExtensionRuntime;
    isNewInstall?: boolean;
    languageModelAccessInformation?: vscode.LanguageModelAccessInformation;
  } = {}) {
    this.extensionVersion = extensionVersion ?? this.extensionVersion;
    this.storageUri = storageUri ?? this.storageUri;
    this.globalStorageUri = globalStorageUri ?? this.globalStorageUri;
    this.logUri = logUri ?? this.logUri;
    this.extensionMode = extensionMode ?? this.extensionMode;
    // NOTE: Commented out since this is a vscode proposed api
    // this.extensionRuntime = extensionRuntime ?? this.extensionRuntime;
    this.isNewInstall = isNewInstall ?? this.isNewInstall;
    this.languageModelAccessInformation =
      languageModelAccessInformation ?? this.languageModelAccessInformation;
  }

  dispose() {
    for (const subscription of this.subscriptions) {
      if (subscription && typeof subscription.dispose === 'function') {
        try {
          subscription.dispose();
        } catch (e) {
          console.error('Failed to dispose subscription', e);
        }
      }
    }
    this.subscriptions = [];
  }
}
