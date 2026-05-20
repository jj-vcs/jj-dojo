import * as vscode from 'vscode';
import {OutputChannelLogger} from '../lib/logging/output_channel_logger';
import {setLogger, logInfo} from '../lib/logging/logging';

export async function activate(context: vscode.ExtensionContext) {
  const logger = new OutputChannelLogger();
  context.subscriptions.push(logger);
  setLogger(logger);
  logInfo(`Extension version: ${context.extension.packageJSON.build}`);
  logInfo('Extension activated successfully');
}
