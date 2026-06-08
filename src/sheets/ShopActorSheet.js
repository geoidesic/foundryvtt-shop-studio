import ShopSheetComponent from '~/src/components/sheets/ShopSheet.svelte';
import { MODULE_ID } from '~/src/helpers/constants';

export default class ShopActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [MODULE_ID, 'shop-actor-sheet'],
      template: `modules/${MODULE_ID}/templates/sheets/shop.html`,
      width: 640,
      height: 720,
      resizable: true
    });
  }

  get title() {
    if (this.actor?.name) {
      return `${this.actor.name} — ${game.i18n.localize('foundryvtt-shop-studio.ShopSheetTitle')}`;
    }
    return game.i18n.localize('foundryvtt-shop-studio.ShopSheetTitle');
  }

  async _render(force = false, options = {}) {
    await super._render(force, options);

    if (!this.actor?.isShop) {
      return;
    }

    const root = this.element[0]?.querySelector('[data-shop-sheet-root]');
    if (!root) {
      return;
    }

    if (this.#svelteApp) {
      this.#svelteApp.$destroy();
      this.#svelteApp = null;
    }

    this.#svelteApp = new ShopSheetComponent({
      target: root,
      props: {
        actor: this.actor
      }
    });
  }

  async close(options = {}) {
    if (this.#svelteApp) {
      this.#svelteApp.$destroy();
      this.#svelteApp = null;
    }
    return super.close(options);
  }

  /** @type {import('svelte').SvelteComponent | null} */
  #svelteApp = null;
}
