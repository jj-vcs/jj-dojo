import {WorkspaceState} from './types';

export interface Api {
  getWorkspaceState(): Promise<WorkspaceState>;
}
