import SvelteDocumentSheet from '~/src/documents/DocumentSheet';
import { MODULE_CODE, MODULE_ID } from '~/src/helpers/constants';
import { version } from '../../module.json';
import { localize } from '~/src/helpers/utility';
import { isItemTypeListable } from '~/src/helpers/itemSources';
import { isShopEditing, setShopEditing } from '~/src/helpers/shopIdentity.js';

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
      dragDrop: [{ dragSelector: ".directory-list .item", dropSelector: null }],
    });
  }

  get title() {
    const shopName = this.reactive.document?.name || game.i18n.localize('foundryvtt-shop-studio.ShopSheetTitle');
    const systemVersion = game.system?.version || '';
    return `${shopName} | Shop Studio v${version} | Foundry: ${game.version || ''} | ${game.system?.id || ''}: ${systemVersion}`;
  }

  /**
   * Foundry calls this from sidebar context menus to determine whether
   * a sheet should be shown as viewable.
   * @param {User} user
   * @returns {boolean}
   */
  _canUserView(user) {
    const actor = this.reactive.document;
    if (!actor?.testUserPermission) return true;
    return actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED);
  }

  /**
   * Closes the sheet and resets editing state if it was active.
   * @param {object} [options] - Close options
   * @returns {Promise<void>}
   */
  async close(options = {}) {
    const isEditing = isShopEditing(this.reactive.document);
    if (isEditing && this.reactive.document?.isOwner) {
      await setShopEditing(this.reactive.document, false);
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
      const isEditing = isShopEditing(this.reactive.document);
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
    const current = isShopEditing(actor);
    await setShopEditing(actor, !current);
    this.render();
  }

  /* ------------------------------------------------------------------ */
  /*  Drag & Drop                                                       */
  /* ------------------------------------------------------------------ */

  _canDragStart(selector) {
    return true;
  }

  _canDragDrop(selector) {
    return this.reactive.document?.isOwner || game.user?.isGM;
  }

  _onDragOver(event) { }

  _onDragStart(event) {
    const li = event.currentTarget;
    if (event.target.classList.contains('content-link')) return;

    const actor = this.reactive.document;
    let dragData;
    if (li.dataset.itemId) {
      const item = actor.items.get(li.dataset.itemId);
      dragData = item?.toDragData();
    }
    if (li.dataset.effectId) {
      const effect = actor.effects.get(li.dataset.effectId);
      dragData = effect?.toDragData();
    }
    if (!dragData) return;

    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  /**
   * Handles dropping content onto the sheet — routes to typed handlers.
   */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const actor = this.reactive.document;
    if (!actor || actor.documentName !== 'Actor') return;
    if (!isShopEditing(actor)) {
      ui.notifications.error(localize('EditModeRequired'));
      return false;
    }

    const allowed = Hooks.call('dropActorSheetData', actor, this, data);
    if (allowed === false) return;
    window.GAS.log.g('ITEM TYPE', data.type)
    switch (data.type) {
      case 'Item':
        return this._onDropItem(event, data);
      case 'Actor':
        return this._onDropActor(event, data);
      case 'ActiveEffect':
        return this._onDropActiveEffect(event, data);
      default:
        return;
    }
  }

  /**
   * Handles dropping an Item onto the sheet.
   * Validates the item type against module settings and creates embedded items
   * via Foundry's API so all hooks fire and TJSDocument reactivity works.
   */
  async _onDropItem(event, data) {
    window.GAS.log.g('DROP ITEM', event, data);
    const actor = this.reactive.document;
    if (!actor?.isOwner) {
      ui.notifications.warn(localize('NoPermission'));
      return false;
    }

    const droppedItem = await fromUuid(data.uuid);
    window.GAS.log.g('DROPPED ITEM', droppedItem);
    if (!droppedItem) return false;

    // Validate item type against module settings
    if (!isItemTypeListable(droppedItem.type)) {
      ui.notifications.warn(localize('ItemTypeNotAllowed'));
      return false;
    }

    
    // If a duplicate exists, increment quantity instead
    const duplicate = actor.items.find((i) => i.name === droppedItem.name);
    if (duplicate) {
      await duplicate.update({
        system: { quantity: (duplicate.system?.quantity ?? 0) + 1 },
      });
      window.GAS.log.g('DUPLICATE ITEM', duplicate);
      window.GAS.log.g('ACTOR ITEMS', actor.items);

      return true;
    }

    const item = await Item.implementation.fromDropData(data);
    const itemData = item.toObject();


    window.GAS.log.g('ITEM FROM DROP DATA', item);
    window.GAS.log.g('ITEM TO OBJECT, BEFORE CREATION', itemData);

    // Handle item sorting within the same Actor
    if (actor.uuid === item.parent?.uuid) {
      window.GAS.log.g('SORTING WITHIN ACTOR');
      return this._onSortItem(event, itemData);
    }

    // Create via the actor's embedded-document API so all Foundry hooks fire
    // and DynMapReducer picks up the change reactively
    return this._onDropItemCreate(itemData);
  }

  /** Handles actor-on-actor drops (no-op for shops) */
  async _onDropActor(event, data) {
    return false;
  }

  /** Handles active-effect drops */
  async _onDropActiveEffect(event, data) {
    const actor = this.reactive.document;
    const effect = await ActiveEffect.implementation.fromDropData(data);
    if (!actor?.isOwner || !effect || actor.uuid === effect.parent?.uuid) {
      return false;
    }
    return ActiveEffect.create(effect.toObject(), { parent: actor });
  }

  /**
   * Creates embedded Item documents on the actor — this fires Foundry hooks
   * that TJSDocument's DynMapReducer listens to for reactive updates.
   */
  async _onDropItemCreate(itemData) {
    const actor = this.reactive.document;
    const data = Array.isArray(itemData) ? itemData : [itemData];
    window.GAS.log.g('DROP ITEM DATA', data);
    // Strip _id so Foundry creates new documents rather than trying to update
    for (const d of data) delete d._id;
    return actor.createEmbeddedDocuments('Item', data);
  }
}
