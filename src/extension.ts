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

import * as vscode from 'vscode';
import {ApiImpl} from './api/api_impl';
import {SubprocessClient} from './client/subprocess_client';
import {setGlobalLogger, logInfo, removeGlobalLogger} from './logging/logging';
import {OutputChannelLogger} from './logging/output_channel_logger';
import {JjUi} from './ui/ui';

export async function activate(context: vscode.ExtensionContext) {
  const logger = new OutputChannelLogger();
  context.subscriptions.push(logger);
  setGlobalLogger(logger);
  logInfo(`Extension version: ${context.extension.packageJSON.build}`);

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    logInfo('No workspace folders found');
    return;
  }
  const client = new SubprocessClient(workspaceRoot);
  const api = new ApiImpl(client);

  const jjUi = new JjUi(context, api);
  context.subscriptions.push(jjUi);

  logInfo('Extension activated successfully');
}

export async function deactivate() {
  removeGlobalLogger();
}
