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
 * Table of time units in descending order, format:
 * - `[# seconds in unit, singular unit name, plural unit name]`
 *
 * e.g.
 * - `<# seconds in a year>, 'year', years`'
 * - `...`
 * - `1, 'second', 'seconds'`
 */
const timeTable: Array<[number, string, string]> = [
  [365 * 24 * 3600, 'year', 'years'],
  [30 * 24 * 3600, 'month', 'months'],
  [7 * 24 * 3600, 'week', 'weeks'],
  [24 * 3600, 'day', 'days'],
  [3600, 'hour', 'hours'],
  [60, 'minute', 'minutes'],
  [1, 'second', 'seconds'],
];

function format(units: number, singular: string, plural: string): string {
  if (units === 1) {
    return `1 ${singular}`;
  }
  return `${units} ${plural}`;
}

/**
 * Function that returns a human-readable string representing the amount of time
 * from `date` until the current time.
 *
 * This intentionally tries to mirror Mercurial's implementation so we provide
 * the same result as if the user ran `hg xl`, which internally uses the `age`
 * template filter.
 *
 * -
 * https://www.mercurial-scm.org/repo/hg/file/tip/mercurial/templatefilters.py#l63
 *
 * Examples return values:
 * - `now`
 * - `10 seconds ago`
 * - `5 minutes ago`
 * - `2 hours ago`
 * - `2 days ago`
 * - `1 week ago`
 * - `1 month ago`
 * - `3 years ago`
 */
export function age(thenUnixTimestamp: number): string {
  // `Date.now()` returns the number of millseconds instead of seconds.
  const nowUnixTimestamp = Math.floor(Date.now() / 1000);
  if (nowUnixTimestamp === thenUnixTimestamp) {
    return 'now';
  }
  const delta = Math.abs(nowUnixTimestamp - thenUnixTimestamp);
  let future = false;
  if (thenUnixTimestamp > nowUnixTimestamp) {
    future = true;

    // Mirror mercurial: if it's >30 years from now,
    // return `in the distant future`.
    if (delta > timeTable[0][0] * 30) {
      return 'in the distant future';
    }
  } else if (delta > timeTable[0][0] * 2) {
    // Mirror mercurial: return a short date for things in the far past.
    // The `Date` constructor requires the timestamp to be in milliseconds
    // instead of seconds.
    return new Date(thenUnixTimestamp * 1000).toDateString();
  }
  for (const [seconds, singular, plural] of timeTable) {
    const units = Math.floor(delta / seconds);
    if (units >= 2 || seconds === 1) {
      if (future) {
        return `${format(units, singular, plural)} from now`;
      }
      return `${format(units, singular, plural)} ago`;
    }
  }
  return 'now';
}
