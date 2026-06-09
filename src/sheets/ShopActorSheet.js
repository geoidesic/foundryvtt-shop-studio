import SvelteDocumentSheet from '~/src/documents/DocumentSheet';
import { MODULE_CODE, MODULE_ID } from '~/src/helpers/constants';
import { version } from '../../module.json';
import { localize } from '~/src/helpers/utility'

export default class ShopActorSheet extends SvelteDocumentSheet {
  static get defaultOptions() {
    const classes = [MODULE_CODE, MODULE_ID, 'shop-actor-sheet'];
    if (Number(game.version) >= 13) {
      classes.push('gas-v13-plus');
    }
    const foundryVersion = game.version || '';

    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'foundryvtt-shop-studio-sheet',
      title: `${localize('ShopStudio')} v${version} | Foundry: ${foundryVersion}`,
      classes,
      width: 640,
      height: 720,
      resizable: true,
      minimizable: true,
      headerButtonNoLabel: false,
      headerIcon: 'modules/foundryvtt-shop-studio/assets/shop-studio-logo-dragon-be7c41ff.webp',
      dragDrop: [{ dragSelector: '.directory-list .item', dropSelector: null }],
    });
  }

  get title() {
    const shopName = this.reactive.document?.name || game.i18n.localize('foundryvtt-shop-studio.ShopSheetTitle');
    const systemVersion = game.system?.version || '';
    return `${shopName} | Shop Studio v${version} | Foundry: ${game.version || ''} | ${game.system?.id || ''}: ${systemVersion}`;
  }
}
