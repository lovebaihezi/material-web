/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import '../../elevation/elevation.js';
import '../../focus/focus-ring.js';
import '../../ripple/ripple.js';

import {html, LitElement, nothing, PropertyValues, TemplateResult} from 'lit';
import {property, query, queryAsync, state} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {when} from 'lit/directives/when.js';

import {requestUpdateOnAriaChange} from '../../aria/delegate.js';
import {dispatchActivationClick, isActivationClick} from '../../controller/events.js';
import {ripple} from '../../ripple/directive.js';
import {MdRipple} from '../../ripple/ripple.js';

/**
 * An element that can select items.
 */
export interface SelectionGroupElement extends HTMLElement {
  selected?: number;
  selectedItem?: Tab;
  previousSelectedItem?: Tab;
}

const hidden: Keyframe = {
  'opacity': 0,
  'transform': 'none'
};

const showing: Keyframe = {
  'transform': 'none',
  'opacity': 1
};

const scaled: Keyframe = {
  'transform': 'scaleX(0.5)'
};

/**
 * Tab component.
 */
export class Tab extends LitElement {
  static {
    requestUpdateOnAriaChange(this);
  }

  static override shadowRootOptions:
      ShadowRootInit = {mode: 'open', delegatesFocus: true};

  /**
   * Styling variant to display, 'primary' or 'secondary' and can also
   * include `vertical`.
   * Defaults to `primary`.
   */
  @property({reflect: true}) variant = 'primary';

  /**
   * Whether or not the item is `disabled`.
   */
  @property({type: Boolean, reflect: true}) disabled = false;

  /**
   * Whether or not the item is `selected`.
   **/
  @property({type: Boolean, reflect: true}) selected = false;

  /**
   * Whether or not the icon renders inline with label or stacked vertically.
   */
  @property({type: Boolean}) inlineIcon = false;

  @query('.button') private readonly button!: HTMLElement;

  @queryAsync('md-ripple') private readonly ripple!: Promise<MdRipple|null>;

  // note, this is public so it can participate in selection animation.
  /**
   * Selection indicator element.
   */
  @query('.indicator') readonly indicator!: HTMLElement;

  @state() private rippleRequested = false;

  // whether or not selection state can be animated; used to avoid initial
  // animation and becomes true one task after first update.
  private canAnimate = false;

  constructor() {
    super();
    this.addEventListener('click', (event: MouseEvent) => {
      if (!isActivationClick((event))) {
        return;
      }
      this.focus();
      dispatchActivationClick(this.button);
    });
  }

  override focus() {
    this.button.focus();
  }

  override blur() {
    this.button.blur();
  }

  protected override render(): TemplateResult {
    const contentClasses = {
      inlineIcon: this.inlineIcon,
    };
    return html`
      <button
        class="button md3-button"
        ?disabled=${this.disabled}
        aria-label=${this.ariaLabel || nothing}
        ${ripple(this.getRipple)}
      >
        <md-focus-ring></md-focus-ring>
        <md-elevation surface></md-elevation>
        ${when(this.rippleRequested, this.renderRipple)}
        <span class="touch"></span>
        <div class="content ${classMap(contentClasses)}">
          <slot name="icon"></slot>
          <span class="label">
            <slot></slot>
          </span>
          <div class="indicator ${this.selected ? 'showing' : 'hidden'}"></div>
        </div>
      </button>`;
  }

  protected override async firstUpdated() {
    await new Promise(requestAnimationFrame);
    this.canAnimate = true;
  }

  protected override updated(changed: PropertyValues) {
    if (changed.has('selected') && this.shouldAnimate()) {
      this.animateSelected();
    }
  }

  private shouldAnimate() {
    return this.canAnimate && !this.disabled &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private readonly getRipple = () => {
    this.rippleRequested = true;
    return this.ripple;
  };

  private readonly renderRipple = () => {
    return html`<md-ripple ?disabled="${this.disabled}"></md-ripple>`;
  };

  private get selectionGroup() {
    return this.parentElement as SelectionGroupElement;
  }

  private animateSelected() {
    this.indicator.getAnimations().forEach(a => {
      a.cancel();
    });
    const frames = this.getKeyframes();
    if (frames !== null) {
      this.indicator.animate(frames, {duration: 400, easing: 'ease-out'});
    }
  }

  private getKeyframes() {
    const selected = showing;
    let unselected: Keyframe = hidden;
    if (this.variant.includes('navigation')) {
      unselected = {...unselected, ...scaled};
    } else {
      if (this.selected) {
        const isVertical = this.variant.includes('vertical');
        const fromRect =
            (this.selectionGroup?.previousSelectedItem?.indicator
                 .getBoundingClientRect() ??
             ({} as DOMRect));
        const fromPos = isVertical ? fromRect.top : fromRect.left;
        const fromExtent = isVertical ? fromRect.height : fromRect.width;
        if (fromPos !== undefined) {
          const toRect = this.indicator.getBoundingClientRect();
          const toPos = isVertical ? toRect.top : toRect.left;
          const toExtent = isVertical ? toRect.height : toRect.width;
          const axis = isVertical ? 'Y' : 'X';
          unselected = {
            'transform': `translate${axis}(${fromPos - toPos}px)
            scale${axis}(${fromExtent / toExtent})`
          };
        }
      } else {
        return null;
      }
    }
    return this.selected ? [unselected, selected] : [selected, unselected];
  }
}
