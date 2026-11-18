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

/// <reference types="node" />

import 'jasmine';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import {assertHermeticJjConfigured, resolveHermeticJjDir} from './hermetic_jj';
import {newRepo} from './new_repo';

describe('hermetic_jj', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-jj-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  });

  describe('assertHermeticJjConfigured', () => {
    it('throws when JJ_VERSION is missing', () => {
      expect(() => assertHermeticJjConfigured({})).toThrowError(
        /JJ_VERSION environment variable is not set/,
      );
    });

    it('returns configured JJ_VERSION when present', () => {
      expect(assertHermeticJjConfigured({JJ_VERSION: 'v0.45.1'})).toBe(
        'v0.45.1',
      );
    });
  });

  describe('resolveHermeticJjDir', () => {
    it('throws when TEST_SRCDIR is missing', () => {
      expect(() =>
        resolveHermeticJjDir({JJ_VERSION: 'v0.44.0'}, 'linux'),
      ).toThrowError(/TEST_SRCDIR environment variable is not set/);
    });

    it('throws when POSIX jj binary does not exist in runfiles', () => {
      expect(() =>
        resolveHermeticJjDir(
          {JJ_VERSION: 'v0.44.0', TEST_SRCDIR: tmpDir},
          'linux',
        ),
      ).toThrowError(
        /Hermetic jj binary not found.*copy_jj_v0_44_0 is staged in test data/,
      );
    });

    it('throws when Windows jj.exe binary does not exist in runfiles', () => {
      const posixDir = path.join(
        tmpDir,
        '_main',
        'tools',
        'bazel',
        'jj',
        'v0.45.1',
      );
      fs.mkdirSync(posixDir, {recursive: true});
      fs.writeFileSync(path.join(posixDir, 'jj'), '');

      expect(() =>
        resolveHermeticJjDir(
          {JJ_VERSION: 'v0.45.1', TEST_SRCDIR: tmpDir},
          'win32',
        ),
      ).toThrowError(/Hermetic jj binary not found.*jj\.exe/);
    });

    it('resolves POSIX jj directory when jj binary exists', () => {
      const expectedDir = path.join(
        tmpDir,
        '_main',
        'tools',
        'bazel',
        'jj',
        'v0.44.0',
      );
      fs.mkdirSync(expectedDir, {recursive: true});
      fs.writeFileSync(path.join(expectedDir, 'jj'), '');

      expect(
        resolveHermeticJjDir(
          {JJ_VERSION: 'v0.44.0', TEST_SRCDIR: tmpDir},
          'darwin',
        ),
      ).toBe(expectedDir);
    });

    it('resolves Windows jj directory when jj.exe binary exists', () => {
      const expectedDir = path.join(
        tmpDir,
        '_main',
        'tools',
        'bazel',
        'jj',
        'v0.45.1',
      );
      fs.mkdirSync(expectedDir, {recursive: true});
      fs.writeFileSync(path.join(expectedDir, 'jj.exe'), '');

      expect(
        resolveHermeticJjDir(
          {JJ_VERSION: 'v0.45.1', TEST_SRCDIR: tmpDir},
          'win32',
        ),
      ).toBe(expectedDir);
    });
  });

  describe('newRepo guard', () => {
    it('throws immediately when test target omits use_jj = True', () => {
      const savedVersion = process.env.JJ_VERSION;
      delete process.env.JJ_VERSION;
      try {
        expect(() => newRepo()).toThrowError(
          /JJ_VERSION environment variable is not set.*use_jj = True/,
        );
      } finally {
        if (savedVersion !== undefined) {
          process.env.JJ_VERSION = savedVersion;
        }
      }
    });
  });
});
