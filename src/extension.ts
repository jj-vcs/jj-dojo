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

import * as vscode from 'vscode';
import {OutputChannelLogger} from './logging/output_channel_logger';
import {setGlobalLogger, logInfo, removeGlobalLogger} from './logging/logging';
import {JjApi} from './api/jj_api';
import {SubprocessClient} from './client/subprocess_client';

export async function activate(context: vscode.ExtensionContext) {
  const logger = new OutputChannelLogger();
  context.subscriptions.push(logger);
  setGlobalLogger(logger);
  const uri = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (uri) {
    const client = new SubprocessClient(uri);
    const api = new JjApi({client});
  }
  logInfo(`Extension version: ${context.extension.packageJSON.build}`);
  logInfo('Extension activated successfully');
}

export async function deactivate() {
  removeGlobalLogger();
}
