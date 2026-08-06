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

import {LitElement} from 'lit';
import {customElement, property, state} from 'lit/decorators';
import type {Target} from './drag_and_drop_state';
import {getManager, isEqual} from './drag_and_drop_state';

/**
 * A LitElement that subscribes to drag and drop events.
 *
 * This LitElement subscribes to drag and drop events published by
 * <jj-drag-and-drop-publisher>. See drag_and_drop_publisher.ts for more
 * details.
 *
 * Users of this component should extend this class, and use `isDragSource` and
 * `isDragDestination` to determine whether the element is the source or
 * destination of the drag.
 */
@customElement('jj-drag-and-drop-subscriber')
export class JjDragAndDropSubscriber extends LitElement {
  // If defined, this LitElement will subscribe to drag and drop events of
  // the provided target. If undefined, this LitElement does not subscribe to
  // any drag and drop events.
  @property({attribute: false}) subscribedTarget?: Target;

  @state() isDragSource = false;
  @state() isDragDestination = false;

  override connectedCallback() {
    super.connectedCallback();
    getManager().subscribe(this.stateChanged);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    getManager().unsubscribe(this.stateChanged);
  }

  private readonly stateChanged = () => {
    if (this.subscribedTarget === undefined) {
      return;
    }
    const dragged = getManager().getDragged();
    let hovered = getManager().getHovered();

    // When dragging a commit or a bookmark onto a bookmark, we still want to show it's
    // the commit that is being hovered over.
    if (
      (dragged?.type === 'commit' || dragged?.type === 'bookmark') &&
      hovered?.type === 'bookmark'
    ) {
      hovered = {
        type: 'commit',
        data: hovered.data.node,
      };
    }

    this.isDragSource = isEqual(this.subscribedTarget, dragged);
    this.isDragDestination = isEqual(this.subscribedTarget, hovered);
  };
}

/**
 * A LitElement that subscribes to drag and drop events of all targets.
 */
export class JjDragAndDropAllTargetsSubscriber extends LitElement {
  @state() dragged?: Target;
  @state() hovered?: Target;

  override connectedCallback() {
    super.connectedCallback();
    getManager().subscribe(this.stateChanged);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    getManager().unsubscribe(this.stateChanged);
  }

  private readonly stateChanged = () => {
    this.dragged = getManager().getDragged();
    this.hovered = getManager().getHovered();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'jj-drag-and-drop-subscriber': JjDragAndDropSubscriber;
  }
}
