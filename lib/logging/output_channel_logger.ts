import {Logger} from './logger';
import * as vscode from 'vscode';

export class OutputChannelLogger implements Logger, vscode.Disposable {
  private readonly channel = vscode.window.createOutputChannel('JJ Extension', {
    log: true,
  });

  info(message: string) {
    this.channel.info(message);
  }

  error(message: string | Error) {
    this.channel.error(message);
  }

  dispose() {
    this.channel.dispose();
  }
}
