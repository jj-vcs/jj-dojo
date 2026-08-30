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
import {state} from 'lit/decorators';

/**
 * The direction of the resize event.
 */
enum Direction {
  UNKNOWN,
  INCREASING,
  DECREASING,
}

/**
 * Likely due to a VS Code bug or webview limitations, webviews gets resize
 * events in an incorrect order. e.g. If you drag the webview and make it wider,
 * typically we get resize events like the following:
 * - width: x
 * - width: x + 20
 * - width: x + 30
 * - width: x + 40
 * - width: x
 * - width: x + 22 // This doesn't have to be 20. It can be a new number.
 * - width: x + 30
 * - width: x + 40
 *
 * This is a known issue with VS Code webviews. For the commit graph, this
 * causes the top bar blue buttons to "shake" because its sizes are not
 * monotonically increasing/decreasing.
 *
 * A workaround is to use go/cider-native-view. It works perfectly, but it's
 * a Cider specific feature and only works within google. This class provides
 * another workaround. It alleviates the shaking issue by skipping resize events
 * that are not in the intended direction. It does not work as well as native
 * views, and is quite hacky, but it also works outside of google.
 */
export class JjResizeController extends LitElement {
  /**
   * The current width of the HTML element. As the `@state` annotation suggests,
   * setting this field will trigger a re-render.
   */
  @state() protected renderedWidth?: number;

  /**
   * The widths that were rendered before. Since VS Code sends resize events
   * in the incorrect order, skipping past widths help reduce a lot of noise.
   *
   * To ensure correctness, we create a `setTimeout` callback that will re-render
   * the component after a short delay.
   */
  private readonly pastWidths = new Set<number>();

  /**
   *
   * The id of the setTimeout callback that will re-render the component.
   */
  private renderAgain?: ReturnType<typeof setTimeout>;

  /**
   * The last width received from `resize` events.
   */
  private lastWidth?: number;

  /**
   * The last known direction of the resize event.
   */
  private direction = Direction.UNKNOWN;

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('resize', this.handleResize);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.handleResize);
  }

  private readonly handleResize = () => {
    if (!this.shadowRoot) {
      return;
    }
    const incomingWidth = this.computeWidth();
    if (incomingWidth === this.lastWidth) {
      // This was fully processed before. No need to process again.
      return;
    }

    const lastWidth = this.lastWidth;
    this.lastWidth = incomingWidth;

    // Create a setTimeout callback to ensure eventual consistency.
    clearTimeout(this.renderAgain);
    this.renderAgain = setTimeout(() => {
      this.renderedWidth = incomingWidth;
      this.pastWidths.clear();
      this.direction = Direction.UNKNOWN;
    }, 100);

    if (this.pastWidths.has(incomingWidth)) {
      return;
    }
    this.pastWidths.add(incomingWidth);

    // Calculate the intended direction.
    if (lastWidth === undefined) {
      this.direction = Direction.UNKNOWN;
    } else if (this.direction === Direction.UNKNOWN) {
      this.direction = getDirection(lastWidth, incomingWidth);
    } else {
      const newDirection = getDirection(lastWidth, incomingWidth);
      if (newDirection !== this.direction) {
        this.direction = Direction.UNKNOWN;
      }
    }

    // Only render if the intended direction matches the actual direction.
    if (this.renderedWidth === undefined) {
      this.renderedWidth = incomingWidth;
    } else {
      const actualDirection = getDirection(this.renderedWidth, incomingWidth);
      if (actualDirection === this.direction) {
        this.renderedWidth = incomingWidth;
      }
    }
  };

  protected computeWidth() {
    if (!this.shadowRoot) {
      return 0;
    }
    return parseWidthString(
      getComputedStyle(this.shadowRoot.host).getPropertyValue('width'),
    );
  }
}

function getDirection(before: number, after: number) {
  return after > before ? Direction.INCREASING : Direction.DECREASING;
}

function parseWidthString(widthString: string): number {
  if (widthString.endsWith('px')) {
    return Number(widthString.slice(0, -2));
  }
  throw new Error(`Invalid width string: ${widthString}`);
}
