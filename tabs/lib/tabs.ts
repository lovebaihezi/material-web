/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {html, LitElement, PropertyValues} from 'lit';
import {property, state} from 'lit/decorators.js';

/**
 * Type for list items.
 */
export interface Tab extends HTMLElement {
  disabled?: boolean;
  selected?: boolean;
  variant?: string;
}

const TAB_INDEX_ATTR = 'tabindex';

/**
 * Tabs component.
 */
export class Tabs extends LitElement {
  static override readonly shadowRootOptions = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true
  };

  private static readonly navigationKeys = new Map([
    ['default', new Set(['Home', 'End', 'Space'])],
    ['horizontal', new Set(['ArrowLeft', 'ArrowRight'])],
    ['vertical', new Set(['ArrowUp', 'ArrowDown'])]
  ]);

  /**
   * Styling variant to display; defaults to `primary`.
   */
  @property({type: String, reflect: true}) variant = 'primary';

  /**
   * Whether or not the item is `disabled`.
   */
  @property({type: Boolean}) disabled = false;

  /**
   * Index of the selected item.
   */
  @property({type: Number}) selected = 0;

  /**
   * Whether or not to select an item when focused.
   */
  @property({type: Boolean}) selectOnFocus = false;

  private previousSelected = -1;
  private orientation = 'horizontal';
  private readonly scrollMargin = 48;
  // note, populated via slotchange.
  @state() private items: Tab[] = [];

  private readonly selectedAttribute = `selected`;

  /**
   * The item currently selected.
   */
  get selectedItem() {
    return this.items[this.selected];
  }

  /**
   * The item previously selected.
   */
  get previousSelectedItem() {
    return this.items[this.previousSelected];
  }

  /**
   * The item currently focused.
   */
  protected get focusedItem() {
    return this.items.find((e: HTMLElement) => e.matches(':focus-within'));
  }

  constructor() {
    super();
    // focus item on keydown and optionally select it
    this.addEventListener('keydown', async (event: KeyboardEvent) => {
      const {key} = event;
      const shouldHandleKey = Tabs.navigationKeys.get('default')!.has(key) ||
          Tabs.navigationKeys.get(this.orientation)!.has(key);
      // await to after user may cancel event.
      if (!shouldHandleKey || (await this.wasEventPrevented(event)) ||
          this.disabled) {
        return;
      }
      let indexToFocus = -1;
      const focused = this.focusedItem ?? this.selectedItem;
      const itemCount = this.items.length;
      const isPrevKey = key === 'ArrowLeft' || key === 'ArrowUp';
      const isNextKey = key === 'ArrowRight' || key === 'ArrowDown';
      if (key === 'Home') {
        indexToFocus = 0;
      } else if (key === 'End') {
        indexToFocus = itemCount - 1;
      } else if (key === 'Space') {
        indexToFocus = this.items.indexOf(focused);
      } else if (isPrevKey || isNextKey) {
        const d = (this.items.indexOf(focused) || 0) +
            (isPrevKey     ? -1 :
                 isNextKey ? 1 :
                             0);
        indexToFocus = d < 0 ? itemCount - 1 : d % itemCount;
      }
      const itemToFocus =
          this.findFocusableItem(indexToFocus, key === 'End' || isPrevKey);
      indexToFocus = this.items.indexOf(itemToFocus!);
      if (itemToFocus !== null && itemToFocus !== focused) {
        const shouldSelect = this.selectOnFocus || key === 'Space';
        if (shouldSelect) {
          this.selected = indexToFocus;
        }
        this.updateFocusableItem(itemToFocus);
        itemToFocus.focus();
        if (shouldSelect) {
          await this.dispatchInteraction();
        }
      }
    });

    // scroll to item on keyup.
    this.addEventListener('keyup', () => {
      this.scrollItemIntoView(this.focusedItem ?? this.selectedItem);
    });

    // restore focus to selected item when blurring.
    this.addEventListener('focusout', async (e) => {
      await this.updateComplete;
      const nowFocused = (this.getRootNode() as unknown as DocumentOrShadowRoot)
                             .activeElement as Tab;
      if (this.items.indexOf(nowFocused) === -1) {
        this.updateFocusableItem(this.selectedItem);
      }
    });
  }

  private findFocusableItem(i = -1, prev = false, tries = 0): Tab|null {
    const itemCount = this.items.length - 1;
    while (this.items[i]?.disabled && tries <= itemCount) {
      tries++;
      i = (i + (prev ? -1 : 1));
      if (i > itemCount) {
        return this.findFocusableItem(0, false, tries);
      } else if (i < 0) {
        return this.findFocusableItem(itemCount, true, tries);
      }
    }
    return this.items[i] ?? null;
  }

  private async wasEventPrevented(event: Event, preventNativeDefault = false) {
    if (preventNativeDefault) {
      // prevent native default to stop, e.g. scrolling.
      event.preventDefault();
      // reset prevention to see if user is cancelling this action.
      Object.defineProperties(event, {
        'defaultPrevented': {value: false, writable: true, configurable: true},
        'preventDefault': {
          value() {
            this.defaultPrevented = true;
          },
          writable: true,
          configurable: true
        }
      });
    }
    // allow event to propagate to user code.
    await new Promise(requestAnimationFrame);
    return event.defaultPrevented;
  }

  private async dispatchInteraction() {
    // wait for items to render.
    await new Promise(requestAnimationFrame);
    const event = new Event('change', {bubbles: true});
    this.dispatchEvent(event);
  }

  protected override willUpdate(changed: PropertyValues) {
    if (changed.has('selected')) {
      this.previousSelected = changed.get('selected') ?? 0;
    }
    if (changed.has('variant')) {
      this.orientation =
          this.variant.includes('vertical') ? 'vertical' : 'horizontal';
    }
  }

  protected override updated(changed: PropertyValues) {
    const itemsOrVariantChanged =
        changed.has('items') || changed.has('variant');
    // sync variant with items.
    if (itemsOrVariantChanged || changed.has('disabled')) {
      this.items.forEach(i => {
        i.variant = this.variant;
        i.disabled = this.disabled;
      });
    }
    if (itemsOrVariantChanged || changed.has('selected')) {
      const itemWithSelectedAttribute =
          this.querySelector(`:scope > [${this.selectedAttribute}]`);
      if (itemWithSelectedAttribute !== this.selectedItem) {
        itemWithSelectedAttribute?.removeAttribute(this.selectedAttribute);
        this.selectedItem?.setAttribute(this.selectedAttribute, '');
      }
      if (this.selectedItem !== this.focusedItem) {
        this.updateFocusableItem(this.selectedItem);
      }
      this.scrollItemIntoView();
    }
  }

  private updateFocusableItem(item: HTMLElement|null) {
    this.items.forEach(e => {
      if (e === item) {
        e.removeAttribute(TAB_INDEX_ATTR);
      } else {
        e.setAttribute(TAB_INDEX_ATTR, '-1');
      }
    });
  }

  protected override render() {
    return html`
      <slot @slotchange=${this.handleSlotChange} @click=${
        this.handleItemClick}></slot>  
    `;
  }

  private async handleItemClick(event: Event) {
    const {target} = event;
    if (await this.wasEventPrevented(event)) {
      return;
    }
    const item = (target as Element).closest(`${this.localName} > *`) as Tab;
    const i = this.items.indexOf(item);
    if (i > -1 && this.selected !== i) {
      this.selected = i;
      this.updateFocusableItem(this.selectedItem);
      item.focus();
      await this.dispatchInteraction();
    }
  }

  private handleSlotChange(e: Event) {
    this.items =
        (e.target as HTMLSlotElement).assignedElements({flatten: true}) as
        Tab[];
  }

  /**
   * Ensures the given item is visible in view; defaults to the selected item.
   **/
  async scrollItemIntoView(item = this.selectedItem) {
    if (!item) {
      return;
    }
    // wait for items to render.
    await new Promise(requestAnimationFrame);
    const isVertical = this.orientation === 'vertical';
    const offset = isVertical ? item.offsetTop : item.offsetLeft;
    const extent = isVertical ? item.offsetHeight : item.offsetWidth;
    const scroll = isVertical ? this.scrollTop : this.scrollLeft;
    const hostExtent = isVertical ? this.offsetHeight : this.offsetWidth;
    const min = offset - this.scrollMargin;
    const max = offset + extent - hostExtent + this.scrollMargin;
    const to = Math.min(min, Math.max(max, scroll));
    this.scrollTo({
      behavior: 'smooth',
      [isVertical ? 'left' : 'top']: 0,
      [isVertical ? 'top' : 'left']: to
    });
  }
}
