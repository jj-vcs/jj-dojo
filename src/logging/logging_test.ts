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

import {installVscode, logs} from '../testing/install_vscode';
import {JjError} from '../error/error';
import {
  setGlobalLogger,
  removeGlobalLogger,
  logError,
  logAndShowInternalError,
} from './logging';
import {OutputChannelLogger} from './output_channel_logger';
import {
  removeGlobalErrorCallback,
  setGlobalErrorCallback,
} from './error_callback';
import {
  setGlobalFeedbackProvider,
  removeGlobalFeedbackProvider,
} from './feedback';

describe('Logger', () => {
  beforeEach(installVscode);

  it('logError should log and set isLogged status', async () => {
    const logger = new OutputChannelLogger();
    setGlobalLogger(logger);

    const err = new JjError('some error');
    const result = logError(err);

    expect(result).toBe(err);
    expect(result.isLogged).toBe(true);
    expect(logs().messages).toEqual([['ERROR', 'some error', undefined]]);

    removeGlobalLogger();
  });

  it('global error callback should append to error', async () => {
    const logger = new OutputChannelLogger();
    setGlobalLogger(logger);
    setGlobalErrorCallback(() => 'extra info');

    const err = new JjError('some error');
    const result = logError(err);

    expect(result).toBe(err);
    expect(result.isLogged).toBe(true);
    expect(logs().messages).toEqual([['ERROR', 'some error', 'extra info']]);

    removeGlobalErrorCallback();
    removeGlobalLogger();
  });

  it('global feedback provider should invoke when internal error is logged', async () => {
    const logger = new OutputChannelLogger();
    setGlobalLogger(logger);

    let feedbackFiled = false;
    setGlobalFeedbackProvider(() => {
      feedbackFiled = true;
    });

    const err = new JjError('internal error');
    const result = logAndShowInternalError(err);

    expect(result).toBe(err);
    expect(result.isInternalError).toBe(true);
    expect(result.isShownToUser).toBe(true);
    expect(feedbackFiled).toBe(true);

    removeGlobalFeedbackProvider();
    removeGlobalLogger();
  });
});
