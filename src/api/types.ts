export class CommitId {
  constructor(readonly hex: string) {}
}

export class ChangeId {
  constructor(readonly hex: string) {}
}

export interface Commit {
  commitId: CommitId;
  changeId: ChangeId;
  description: string;
}

export interface WorkspaceState {
  commits: Commit[];
}
