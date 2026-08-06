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

import 'jasmine';
import {age} from './time';

describe('time utils', () => {
  const NOW_UNIX_TIMESTAMP = 1700000000;

  beforeEach(() => {
    spyOn(Date, 'now').and.returnValue(NOW_UNIX_TIMESTAMP * 1000);
  });

  describe('age', () => {
    it('returns "now" when timestamp equals current time', () => {
      expect(age(NOW_UNIX_TIMESTAMP)).toEqual('now');
    });

    it('returns seconds ago for past timestamps under 2 minutes', () => {
      expect(age(NOW_UNIX_TIMESTAMP - 1)).toEqual('1 second ago');
      expect(age(NOW_UNIX_TIMESTAMP - 45)).toEqual('45 seconds ago');
      expect(age(NOW_UNIX_TIMESTAMP - 119)).toEqual('119 seconds ago');
    });

    it('returns minutes ago for past timestamps starting at 2 minutes', () => {
      expect(age(NOW_UNIX_TIMESTAMP - 120)).toEqual('2 minutes ago');
      expect(age(NOW_UNIX_TIMESTAMP - 45 * 60)).toEqual('45 minutes ago');
    });

    it('returns hours ago for past timestamps starting at 2 hours', () => {
      expect(age(NOW_UNIX_TIMESTAMP - 2 * 3600)).toEqual('2 hours ago');
      expect(age(NOW_UNIX_TIMESTAMP - 23 * 3600)).toEqual('23 hours ago');
    });

    it('returns days ago for past timestamps starting at 2 days', () => {
      expect(age(NOW_UNIX_TIMESTAMP - 2 * 24 * 3600)).toEqual('2 days ago');
      expect(age(NOW_UNIX_TIMESTAMP - 6 * 24 * 3600)).toEqual('6 days ago');
    });

    it('returns weeks ago for past timestamps starting at 2 weeks', () => {
      expect(age(NOW_UNIX_TIMESTAMP - 2 * 7 * 24 * 3600)).toEqual(
        '2 weeks ago',
      );
      expect(age(NOW_UNIX_TIMESTAMP - 3 * 7 * 24 * 3600)).toEqual(
        '3 weeks ago',
      );
    });

    it('returns months ago for past timestamps starting at 2 months', () => {
      expect(age(NOW_UNIX_TIMESTAMP - 2 * 30 * 24 * 3600)).toEqual(
        '2 months ago',
      );
      expect(age(NOW_UNIX_TIMESTAMP - 11 * 30 * 24 * 3600)).toEqual(
        '11 months ago',
      );
    });

    it('returns years ago for past timestamps at exactly 2 years', () => {
      expect(age(NOW_UNIX_TIMESTAMP - 2 * 365 * 24 * 3600)).toEqual(
        '2 years ago',
      );
    });

    it('returns formatted date string for past timestamps older than 2 years', () => {
      const longAgo = NOW_UNIX_TIMESTAMP - (2 * 365 * 24 * 3600 + 1);
      expect(age(longAgo)).toEqual('Sun Nov 14 2021');
    });

    it('returns relative time formatted for future timestamps', () => {
      expect(age(NOW_UNIX_TIMESTAMP + 1)).toEqual('1 second from now');
      expect(age(NOW_UNIX_TIMESTAMP + 5)).toEqual('5 seconds from now');
      expect(age(NOW_UNIX_TIMESTAMP + 120)).toEqual('2 minutes from now');
      expect(age(NOW_UNIX_TIMESTAMP + 2 * 3600)).toEqual('2 hours from now');
      expect(age(NOW_UNIX_TIMESTAMP + 2 * 24 * 3600)).toEqual(
        '2 days from now',
      );
      expect(age(NOW_UNIX_TIMESTAMP + 2 * 7 * 24 * 3600)).toEqual(
        '2 weeks from now',
      );
      expect(age(NOW_UNIX_TIMESTAMP + 2 * 30 * 24 * 3600)).toEqual(
        '2 months from now',
      );
      expect(age(NOW_UNIX_TIMESTAMP + 2 * 365 * 24 * 3600)).toEqual(
        '2 years from now',
      );
    });

    it('returns "in the distant future" for timestamps > 30 years in future', () => {
      const farFuture = NOW_UNIX_TIMESTAMP + (30 * 365 * 24 * 3600 + 1);
      expect(age(farFuture)).toEqual('in the distant future');
    });
  });
});
