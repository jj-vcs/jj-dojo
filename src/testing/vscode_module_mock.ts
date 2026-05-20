import {vi} from 'vitest';

// Without this, tests would fail with `Cannot find package 'vscode' ...`
// because they can't import the vscode module.
//
// To fix this, we utilize vitest's module mocking feature
// https://vitest.dev/guide/mocking/modules.html#mocking-a-module
// to replace it with an empty object {} instead. Each test is then
// responsibile of populating the empty object with fake fields
// and fake implementations.
//
// Please see `vscode_test.ts` as well. That file provides a
// vscode_test rule that automatically clears out all fields in the
// global empty object, and replace them with a clean fake implemenation
// before each test.
vi.mock(import('vscode'), () => {
  return {} as typeof import('vscode');
});
