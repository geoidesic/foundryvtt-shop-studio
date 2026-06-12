import SvelteDocumentSheet from '~/src/documents/DocumentSheet';
import { MODULE_CODE, MODULE_ID } from '~/src/helpers/constants';
import { version } from '../../module.json';
import { localize } from '~/src/helpers/utility'

export default class ShopActorSheet extends SvelteDocumentSheet {
  /**
   * Unique per-instance application ID so multiple shop sheets can be open simultaneously.
   */
  get id() {
    const docId = this.reactive?.document?.id || foundry.utils.randomID();
    return `shop-studio-sheet-${docId}`;
  }

  static get defaultOptions() {
    const classes = [MODULE_CODE, MODULE_ID];
    if (Number(game.version) >= 13) {
      classes.push('gas-v13-plus');
    }
    const foundryVersion = game.version || '';

    return foundry.utils.mergeObject(super.defaultOptions, {
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

  /**
   * Closes the sheet and resets editing state if it was active.
   * @param {object} [options] - Close options
   * @returns {Promise<void>}
   */
  async close(options = {}) {
    const { isEditing } = this.reactive.document?.system?.identity ?? {};
    if (isEditing) {
      await this.reactive.document.update({ system: { identity: { isEditing: false } } });
    }
    await super.close(options);
  }

  /**
   * Gets the header buttons for the sheet window.
   * GMs see an edit/preview toggle that switches between the full
   * GM edit sheet and a player-facing read-only sheet.
   * Players have no toggle and always see the player sheet.
   * @returns {Array<object>} Header button configurations
   */
  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();
    // Only GMs get the edit toggle — players always see the player sheet
    if (game.user.isGM) {
      const isEditing = this.reactive.document?.system?.identity?.isEditing ?? true;
      buttons.unshift({
        label: localize('EditToggle'),
        class: 'edit-shop' + (isEditing ? ' active' : ''),
        icon: 'fas ' + (isEditing ? 'fa-toggle-on' : 'fa-toggle-off'),
        onPress: (ev) => this._onToggleEdit(ev),
      });
    }
    return buttons;
  }

  /**
   * Handles toggling between GM edit mode and player preview mode.
   * Only GMs can toggle; players always see the player view.
   * @param {Event} event - The triggering event
   * @returns {Promise<void>}
   */
  async _onToggleEdit(event) {
    if (event?.event) {
      event.event.preventDefault();
    }
    const actor = this.reactive.document;
    const current = actor?.system?.identity?.isEditing ?? true;
    await actor.update({ system: { identity: { isEditing: !current } } });
    this.render();
  }
}
