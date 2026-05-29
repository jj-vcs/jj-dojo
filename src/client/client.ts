import {WorkspaceState} from '../api/types';

export interface Client {
  getWorkspaceState(): Promise<WorkspaceState>;
}
