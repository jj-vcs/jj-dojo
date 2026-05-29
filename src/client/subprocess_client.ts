import {WorkspaceState, Commit, CommitId, ChangeId} from '../api/types';
import {Client} from '../client/client';
import {subprocess} from './subprocess_util';
import * as vscode from 'vscode';

export class SubprocessClient implements Client {
  constructor(private readonly workspaceRoot: vscode.Uri) {}

  async getWorkspaceState(): Promise<WorkspaceState> {
    return {
      commits: await getCommits(this.workspaceRoot),
    };
  }
}

async function getCommits(workspaceRoot: vscode.Uri): Promise<Commit[]> {
  const fieldDelimiter = '~<jj-vscode-field-delimiter>~';
  const commitDelimiter = '~<jj-vscode-commit-delimiter>~';
  const templateFields = ['commit_id', 'change_id', 'description'];
  const {stdout} = await subprocess({
    cwd: workspaceRoot.path,
    command: 'jj',
    args: [
      // TODO: use --no-integrate-op-log
      'log',
      '--no-graph',
      '-T',
      templateFields.join(` ++ "${fieldDelimiter}" ++ `) +
        ` ++ "${commitDelimiter}" `,
    ],
  });
  const commits: Commit[] = [];
  for (const serializedCommit of stdout.split(commitDelimiter)) {
    const fields = serializedCommit.split(fieldDelimiter);
    commits.push({
      commitId: new CommitId(fields[0]),
      changeId: new ChangeId(fields[1]),
      description: fields[2],
    });
  }
  return commits;
}
