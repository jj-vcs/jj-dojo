import type * as vscode from 'vscode';
import {vi} from 'vitest';

/**
 * @returns a test-only implementation of 'vscode' based on fakes and mocks
 */
export function createVscodeFakeImpl() {
  return {
    window: {
      ...outputChannelsRegistry(),
      showInformationMessage: vi.fn(),
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
