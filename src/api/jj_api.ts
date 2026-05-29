import {Client} from '../client/client';
import {Api} from './api';
import {WorkspaceState} from './types';

export class JjApi implements Api {
  private readonly client: Client;

  constructor({client}: {client: Client}) {
    this.client = client;
  }

  getWorkspaceState(): Promise<WorkspaceState> {
    return this.client.getWorkspaceState();
  }
}
