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

import {FakeTextDocument} from '../../testing/fakes';
import 'jasmine';
import * as vscode from 'vscode';
import {installVscode} from '../../testing/install_vscode';
import {getChangeId, parseTextDocument} from './parser';

describe('Parser', () => {
  beforeEach(() => {
    installVscode();
  });
  it('parses a conflict with only 1 side', () => {
    const document: vscode.TextDocument = new FakeTextDocument({
      text: `<<<<<<< conflict 1 of 1
%%%%%%% diff from: base_change_id base_commit_id "base commit message"
\\\\\\\\\\\\\\        to: change_id_1 commit_id_1 "commit message 1"
 apple
-grape
+grapefruit
 orange
>>>>>>> conflict 1 of 1 ends
`,
    });
    const conflicts = parseTextDocument(document);
    expect(conflicts).toEqual([
      jasmine.objectContaining({
        beginLine: jasmine.objectContaining({
          start: jasmine.objectContaining({line: 0}),
        }),
        sides: [
          jasmine.objectContaining({
            changeId: 'change_id_1',
            range: jasmine.objectContaining({
              start: jasmine.objectContaining({line: 1}),
              end: jasmine.objectContaining({line: 6}),
            }),
          }),
        ],
        endLine: jasmine.objectContaining({
          end: jasmine.objectContaining({line: 7}),
        }),
      }),
    ]);
  });

  it('parses a conflict with 2 sides', () => {
    const document: vscode.TextDocument = new FakeTextDocument({
      text: `<<<<<<< conflict 1 of 1
%%%%%%% diff from: base_change_id base_commit_id "base commit message"
\\\\\\\\\\\\\\        to: change_id_1 commit_id_1 "commit message 1"
 apple
-grape
+grapefruit
 orange
+++++++ change_id_2 commit_id_2 "commit message 2" (blah)
APPLE
GRAPE
ORANGE
>>>>>>> conflict 1 of 1 ends
  `,
    });
    const conflicts = parseTextDocument(document);
    expect(conflicts).toEqual([
      jasmine.objectContaining({
        beginLine: jasmine.objectContaining({
          start: jasmine.objectContaining({line: 0}),
        }),
        sides: [
          jasmine.objectContaining({
            changeId: 'change_id_1',
            range: jasmine.objectContaining({
              start: jasmine.objectContaining({line: 1}),
              end: jasmine.objectContaining({line: 6}),
            }),
          }),
          jasmine.objectContaining({
            changeId: 'change_id_2',
            range: jasmine.objectContaining({
              start: jasmine.objectContaining({line: 7}),
              end: jasmine.objectContaining({line: 10}),
            }),
          }),
        ],
        endLine: jasmine.objectContaining({
          end: jasmine.objectContaining({line: 11}),
        }),
      }),
    ]);
  });

  it('parses a conflict with 3 sides', () => {
    const document: vscode.TextDocument = new FakeTextDocument({
      text: `<<<<<<< conflict 2 of 2
%%%%%%% diff from: base_change_id base_commit_id "base commit message"
\\\\\\\\\\\\\\        to: change_id_1 commit_id_1 "commit message 1"
 apple
+++++++ change_id_2 commit_id_2 "commit message 2"
APPLE
+++++++ change_id_3 commit_id_3 "commit message 3"
Apple
>>>>>>> conflict 2 of 2 ends
`,
    });
    const conflicts = parseTextDocument(document);
    expect(conflicts).toEqual([
      jasmine.objectContaining({
        beginLine: jasmine.objectContaining({
          start: jasmine.objectContaining({line: 0}),
        }),
        sides: [
          jasmine.objectContaining({
            changeId: 'change_id_1',
            range: jasmine.objectContaining({
              start: jasmine.objectContaining({line: 1}),
              end: jasmine.objectContaining({line: 3}),
            }),
          }),
          jasmine.objectContaining({
            changeId: 'change_id_2',
            range: jasmine.objectContaining({
              start: jasmine.objectContaining({line: 4}),
              end: jasmine.objectContaining({line: 5}),
            }),
          }),
          jasmine.objectContaining({
            changeId: 'change_id_3',
            range: jasmine.objectContaining({
              start: jasmine.objectContaining({line: 6}),
              end: jasmine.objectContaining({line: 7}),
            }),
          }),
        ],
        endLine: jasmine.objectContaining({
          end: jasmine.objectContaining({line: 8}),
        }),
      }),
    ]);
  });

  it('returns empty for ill-formed conflict: missing sides', () => {
    const document: vscode.TextDocument = new FakeTextDocument({
      text: `<<<<<<< conflict 1 of 1
>>>>>>> conflict 1 of 1 ends
`,
    });
    const conflicts = parseTextDocument(document);
    expect(conflicts.length).toEqual(0);
  });

  it('returns empty for ill-formed conflict: git-styled conflict', () => {
    const document: vscode.TextDocument = new FakeTextDocument({
      text: `<<<<<<< HEAD:file.txt
Hello world
=======
Goodbye
>>>>>>> 77976da35a11db4580b80ae27e8d65caf5208086:file.txt
`,
    });
    const conflicts = parseTextDocument(document);
    expect(conflicts.length).toEqual(0);
  });

  it('returns empty for ill-formed conflict: missing changeId', () => {
    // The "side #" lines are missing
    const document: vscode.TextDocument = new FakeTextDocument({
      text: `<<<<<<< conflict 1 of 1
%%%%%%%
 apple
+++++++
APPLE
>>>>>>> conflict 1 of 1 ends
`,
    });
    const conflicts = parseTextDocument(document);
    expect(conflicts.length).toEqual(0);
  });

  it('returns empty for ill-formed conflict: no "to" metadata line', () => {
    // The "side #" lines are missing
    const document: vscode.TextDocument = new FakeTextDocument({
      text: `<<<<<<< conflict 1 of 1
%%%%%%% diff from: base_change_id base_commit_id "base commit message"
 apple
+++++++
APPLE
>>>>>>> conflict 1 of 1 ends
`,
    });
    const conflicts = parseTextDocument(document);
    expect(conflicts.length).toEqual(0);
  });

  it('allows semi ill-formed conflict: missing conflict start line', () => {
    const document: vscode.TextDocument = new FakeTextDocument({
      text: `<<<<<<< conflict 1 of 1
 apple
+++++++ change_id_2 commit_id_2 "commit message 2"
APPLE
>>>>>>> conflict 1 of 1 ends
`,
    });
    const conflicts = parseTextDocument(document);
    expect(conflicts).toEqual([
      jasmine.objectContaining({
        beginLine: jasmine.objectContaining({
          start: jasmine.objectContaining({line: 0}),
        }),
        sides: [
          jasmine.objectContaining({
            changeId: 'change_id_2',
            range: jasmine.objectContaining({
              start: jasmine.objectContaining({line: 2}),
              end: jasmine.objectContaining({line: 3}),
            }),
          }),
        ],
        endLine: jasmine.objectContaining({
          end: jasmine.objectContaining({line: 4}),
        }),
      }),
    ]);
  });

  it('allows semi ill-formed conflict: no "to" metadata line', () => {
    const document: vscode.TextDocument = new FakeTextDocument({
      text: `<<<<<<< conflict 1 of 1
%%%%%%% diff from: base_change_id base_commit_id "base commit message"
 apple
+++++++ change_id_2 commit_id_2 "commit message 2"
APPLE
>>>>>>> conflict 1 of 1 ends
`,
    });
    const conflicts = parseTextDocument(document);
    expect(conflicts).toEqual([
      jasmine.objectContaining({
        beginLine: jasmine.objectContaining({
          start: jasmine.objectContaining({line: 0}),
        }),
        sides: [
          jasmine.objectContaining({
            changeId: 'change_id_2',
            range: jasmine.objectContaining({
              start: jasmine.objectContaining({line: 3}),
              end: jasmine.objectContaining({line: 4}),
            }),
          }),
        ],
        endLine: jasmine.objectContaining({
          end: jasmine.objectContaining({line: 5}),
        }),
      }),
    ]);
  });
});

describe('getChangeId', () => {
  it('parses changeId correctly', () => {
    expect(getChangeId('+++++++ change_id commit_id')).toEqual('change_id');
    expect(getChangeId('+++++++ change_id commit_id (foo)')).toEqual(
      'change_id',
    );
    expect(
      getChangeId('+++++++ change_id commit_id (foo) (no terminating newline)'),
    ).toEqual('change_id');
    expect(getChangeId('+++++++ change_id commit_id "commit message"')).toEqual(
      'change_id',
    );
    expect(
      getChangeId('+++++++ change_id commit_id "commit message" (foo)'),
    ).toEqual('change_id');

    expect(getChangeId('\\\\\\\\\\\\\\ to: change_id commit_id')).toEqual(
      'change_id',
    );
    expect(getChangeId('\\\\\\\\\\\\\\ to: change_id commit_id (foo)')).toEqual(
      'change_id',
    );
    expect(
      getChangeId('\\\\\\\\\\\\\\ to: change_id commit_id "commit message"'),
    ).toEqual('change_id');
    expect(
      getChangeId(
        '\\\\\\\\\\\\\\ to: change_id commit_id "commit message" (foo)',
      ),
    ).toEqual('change_id');
    expect(
      getChangeId(
        '\\\\\\\\\\\\\\ to: change_id commit_id (foo) (no terminating newline)',
      ),
    ).toEqual('change_id');

    // We expect both change_id and commit_id to be present as a minimum.
    expect(getChangeId('')).toBeUndefined();
    expect(getChangeId('side #2')).toBeUndefined();
    expect(getChangeId('+++++++ change_id')).toBeUndefined();
    expect(getChangeId('+++++++ change_id "commit message"')).toBeUndefined();
    expect(
      getChangeId('+++++++ change_id "commit message" (foo)'),
    ).toBeUndefined();
    expect(getChangeId('\\\\\\\\\\\\\\ to: change_id')).toBeUndefined();
    expect(
      getChangeId('\\\\\\\\\\\\\\ to: change_id "commit message"'),
    ).toBeUndefined();
    expect(
      getChangeId('\\\\\\\\\\\\\\ to: change_id "commit message" (foo)'),
    ).toBeUndefined();
  });
});
