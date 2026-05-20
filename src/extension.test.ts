import {describe, expect} from 'vitest';
import {activate} from './extension';
import {FakeExtensionContext} from './fakes/fake_extension_context';
import {FakeExtension} from './fakes/fake_extension';
import {vscode_test} from './testing/vscode_test';

describe('Extension', () => {
  vscode_test('should activate and log successfully', async ({log}) => {
    await activate(
      new FakeExtensionContext({
        extension: new FakeExtension({
          packageJSON: {
            build: 'test-version',
          },
        }),
      }),
    );
    expect(log.messages).toEqual([
      ['INFO', 'Extension version: test-version'],
      ['INFO', 'Extension activated successfully'],
    ]);
  });
});
