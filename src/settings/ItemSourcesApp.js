import ItemSourcesAppShell from './ItemSourcesAppShell.svelte';
import { SvelteApplication } from '@typhonjs-fvtt/runtime/svelte/application';

export default class ItemSourcesApp extends SvelteApplication {
  static get defaultOptions() {
    const viewportWidth = globalThis?.innerWidth ?? 1640;
    const defaultWidth = Math.max(620, Math.min(900, Math.floor(viewportWidth * 0.5)));

    return foundry.utils.mergeObject(super.defaultOptions, {
      title: 'Shop Studio - Item Sources',
      id: 'foundryvtt-shop-studio-item-sources-settings',
      resizable: true,
      minimizable: true,
      draggable: true,
      width: defaultWidth,
      height: 740,
      minWidth: 620,
      minHeight: 500,
      headerIcon: 'modules/foundryvtt-shop-studio/assets/shop-studio-logo-dragon-be7c41ff.webp',
      svelte: {
        class: ItemSourcesAppShell,
        target: document.body
      }
    });
  }
}
