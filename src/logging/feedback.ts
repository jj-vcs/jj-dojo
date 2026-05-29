/**
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

/**
 * Invoked when an internal error is logged. The provider can decide whether
 * to pop up a dialog to the user asking to file a bug.
 */
let feedbackProvider: ((error: Error) => void) | undefined;

export function setGlobalFeedbackProvider(input: (error: Error) => void) {
  feedbackProvider = input;
}

export function removeGlobalFeedbackProvider() {
  feedbackProvider = undefined;
}

export function fileFeedback(error: Error) {
  feedbackProvider?.(error);
}
