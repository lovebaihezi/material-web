/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {html} from 'lit';

import {Environment} from '../testing/environment.js';
import {createTokenTests} from '../testing/tokens.js';

import {TabsHarness} from './harness.js';
import {MdTab} from './tab.js';
import {MdTabs} from './tabs.js';

interface TabsTestProps {
  selected?: number;
}

function getTabsTemplate(props?: TabsTestProps) {
  return html`
    <md-tabs
      .selected=${props?.selected ?? 0}
    >
      <md-tab>A</md-tab>
      <md-tab>B</md-tab>
      <md-tab>C</md-tab>
    </md-tabs>`;
}

describe('<md-tabs>', () => {
  const env = new Environment();

  async function setupTest(
      props?: TabsTestProps, template = getTabsTemplate) {
    const root = env.render(template(props));
    await env.waitForStability();
    // ensure advance beyond RAF
    jasmine.clock().tick(1000);
    const tab = root.querySelector<MdTabs>('md-tabs')!;
    const harness = new TabsHarness(tab);
    return {harness, root};
  }

  describe('.styles', () => {
    createTokenTests(MdTabs.styles);
    createTokenTests(MdTab.styles);
  });

  describe('basic', () => {
    it('initializes as an md-tabs and md-tab', async () => {
      const {harness} = await setupTest();
      expect(harness.element).toBeInstanceOf(MdTabs);
      expect(harness.harnessedItems.length).toBe(3);
      harness.harnessedItems.forEach(tabHarness => {
        expect(tabHarness.element).toBeInstanceOf(MdTab);
      });
    });
  });

  describe('properties', () => {
    it('selected', async () => {
      const {harness} = await setupTest({selected: 1});
      expect(harness.element.selected).toBe(1);
      expect(harness.element.selectedItem)
          .toBe(harness.harnessedItems[1].element);
      harness.harnessedItems.forEach(async (tabHarness, i) => {
        const shouldBeSelected = i === harness.element.selected;
        await tabHarness.element.updateComplete;
        expect(tabHarness.element.selected).toBe(shouldBeSelected);
        expect(await tabHarness.isIndicatorShowing()).toBe(shouldBeSelected);
      });
      harness.element.selected = 0;
      await harness.element.updateComplete;
      expect(harness.element.selected).toBe(0);
      harness.harnessedItems.forEach(async (tabHarness, i) => {
        const shouldBeSelected = i === harness.element.selected;
        await tabHarness.element.updateComplete;
        expect(tabHarness.element.selected).toBe(shouldBeSelected);
        expect(await tabHarness.isIndicatorShowing()).toBe(shouldBeSelected);
      });
    });

    it('selectedItem/previousSelectedItem', async () => {
      const {harness} = await setupTest({selected: 1});
      expect(harness.element.selectedItem)
          .toBe(harness.harnessedItems[1].element);
      expect(harness.element.previousSelectedItem)
          .toBe(harness.harnessedItems[0].element);
      harness.element.selected = 0;
      await harness.element.updateComplete;
      expect(harness.element.selectedItem)
          .toBe(harness.harnessedItems[0].element);
      expect(harness.element.previousSelectedItem)
          .toBe(harness.harnessedItems[1].element);
    });
  });
});