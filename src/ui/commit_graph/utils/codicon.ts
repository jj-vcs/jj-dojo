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
 * Parses a codicon string (e.g. 'codicon-loading~spin', 'loading~spin',
 * 'codicon-bookmark', 'bookmark') into a base name ('loading' or 'bookmark')
 * and modifier flags.
 */
export function parseCodicon(rawCodicon: string): {
  name: string;
  spin: boolean;
} {
  let codicon = rawCodicon.trim();

  // Strip codicon- prefix if present.
  if (codicon.startsWith('codicon-')) {
    codicon = codicon.slice('codicon-'.length);
  }

  const spin = codicon.endsWith('~spin');
  if (spin) {
    codicon = codicon.slice(0, -5); // since '~spin'.length is 5
  }

  return {name: codicon, spin};
}
