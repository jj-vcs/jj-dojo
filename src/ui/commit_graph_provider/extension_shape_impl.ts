import {ExtensionShape} from '../commit_graph/api/extension_shape';
import {WebviewShape} from '../commit_graph/api/webview_shape';
import {CommitGraphState} from '../commit_graph/api/types';

/**
 * Implementation of the ExtensionShape that the webview can use to call the
 * extension.
 *
 * TODO: The contents of this file should be replaced by the Google internal code:
 * devtools/cider/extensions/jj/ui/smart_graph/extension_shape_impl.ts
 */
export class ExtensionShapeImpl implements ExtensionShape {
  constructor(private readonly webviewApi: WebviewShape) {}

  async $webviewReady() {
    await this.webviewApi.$setStates([createFakeCommitGraphState()]);
  }

  async $executeCommand() {}

  async $informNewOrder(): Promise<void> {}

  async $informContextMenuWillOpen(): Promise<void> {}

  async $onClick(): Promise<void> {}

  async $clearMultiSelection(): Promise<void> {}

  async $dismissCallout(): Promise<void> {}
}

// TODO - Replace with a real implementation.
function createFakeCommitGraphState(): CommitGraphState {
  return {
    repoName: 'jj-dojo',
    callouts: [],
    commits: [
      {
        hash: 'hash',
        childrenHashes: [],
        bookmarkChips: [],
        shortDescription: 'Commit Short Description',
        fullDescription: 'Commit Full Description',
        active: true,
        isEmpty: true,
        displayId: 'displayId',
        highlightedDisplayIdLen: 8,
        updateTime: Date.now(),
        isMultiSelected: false,
      },
    ],
    topBarButtons: [],
    options: {
      showChangeId: true,
      alwaysShowActions: false,
      showContextMenuIcon: true,
    },
  };
}
