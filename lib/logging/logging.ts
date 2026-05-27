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

import {JjError} from '../error/error';

import {getGlobalErrorCallback} from './error_callback';
import {fileFeedback} from './feedback';
import {Logger} from './logger';

let logger: Logger | undefined;

/**
 * Sets the global logger.
 */
export function setGlobalLogger(newLogger: Logger) {
  logger = newLogger;
}

/**
 * Removes the global logger.
 */
export function removeGlobalLogger() {
  logger = undefined;
}

/**
 * Logs an info message to the global logger.
 */
export function logInfo(message: string) {
  logger?.info(message);
}

/**
 * Logs an info message and shows it to the user.
 */
export function logAndShowInfo(message: string) {
  logInfo(message);
  void vscode.window.showInformationMessage(
    message,
    // Pass an empty options object to bypass linting errors when using
    // testing library
    {},
  );
}

/**
 * Logs an error message to the global logger.
 */
export function logError(unknownError: unknown): JjError {
  const error = JjError.from(unknownError);
  if (error.isLogged) {
    return error;
  }
  error.isLogged = true;
  logger?.error(error, getGlobalErrorCallback?.());
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
  void vscode.window.showErrorMessage(
    error.getMessage(),
    // Pass an empty options object to bypass linting errors when using
    // testing library.
    {},
  );
  return error;
}

export function logAndShowInternalError(unknownError: unknown): JjError {
  const error = JjError.from(unknownError);
  error.isInternalError = true;
  logError(error);
  if (error.isShownToUser) {
    return error;
  }
  error.isShownToUser = true;
  fileFeedback(error);
  return error;
}
