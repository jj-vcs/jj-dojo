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

import {Logger} from './logger';
import {JjError} from '../error/error';
import * as vscode from 'vscode';

let logger: Logger | undefined;

/**
 * Add a logger that can be used globally.
 */
export function setLogger(newLogger: Logger) {
  logger = newLogger;
}

export function logInfo(message: string) {
  if (!logger) {
    throw new Error('logInfo failed: Logger has not been initialized yet');
  }
  logger.info(message);
}

export function logAndShowInfo(message: string) {
  logInfo(message);
  void vscode.window.showInformationMessage(message);
}

export function logError(unknownError: unknown): JjError {
  if (!logger) {
    throw new Error('logError failed: Logger has not been initialized yet');
  }
  const error = JjError.from(unknownError);
  logger.error(error);
  return error;
}

/**
 * Log an error message and show it to the user.
 */
export function logAndShowUserError(unknownError: unknown): JjError {
  const error = logError(unknownError);
  if (error.isShownToUser) {
    return error;
  }
  error.isShownToUser = true;
  void vscode.window.showErrorMessage(error.message);
  return error;
}

export function logAndShowInternalError(unknownError: unknown): JjError {
  const error = JjError.from(unknownError);
  error.isInternalError = true;
  return logAndShowUserError(error);
}
