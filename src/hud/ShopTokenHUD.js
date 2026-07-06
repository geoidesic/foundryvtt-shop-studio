import BasePlaceableHUD from '~/src/documents/DocumentSheet'; // Use the same base as other HUDs
import { MODULE_ID } from '~/src/helpers/constants';
import { localize } from '~/src/helpers/utility';
import ShopActorSheet from '~/src/sheets/ShopActorSheet';

/**
 * A custom HUD for shop tokens.
 * Extends BasePlaceableHUD directly to ensure the PARTS override is respected.
 */
export default class ShopTokenHUD extends BasePlaceableHUD {

  /** @override */
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "token-hud",
    classes: ["placeable-hud", "shop-hud"],
    actions: {
      shopBasket: ShopTokenHUD._onShopBasket,
      visibility: BasePlaceableHUD.#onToggleVisibility,
      locked: BasePlaceableHUD.#onToggleLocked,
      config: BasePlaceableHUD.#onConfigure
    }
  }, { inplace: false });

  /** @override */
  static PARTS = {
    hud: {
      root: true,
      template: `modules/${MODULE_ID}/templates/hud/shop-token-hud.hbs`
    }
  };

  /* -------------------------------------------- */

  /**
   * Convenience reference to the Actor.
   * @type {Actor}
   */
  get actor() {
    return this.document?.actor;
  }

  /* -------------------------------------------- */

  /**
   * Is the bound token a shop token?
   * @type {boolean}
   */
  get isShop() {
    return this.actor?.isShop === true;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Add shop-specific context
    return foundry.utils.mergeObject(context, {
      isShop: this.isShop,
      shopIcon: `modules/${MODULE_ID}/assets/shop-studio-be7c41ff.webp`,
      // Hide irrelevant standard HUD elements for shops
      displayBar1: false,
      displayBar2: false,
      canChangeLevel: false,
      canToggleCombat: false,
      statusEffects: {},
      movementActions: {}
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _updatePosition(position) {
    // Shop HUD is much smaller
    const s = canvas.dimensions.uiScale;
    const {x: left, y: top, width, height} = this.#object.bounds;
    Object.assign(position, {
      left,
      top,
      width: Math.max(180, width / s),
      height: Math.max(60, height / s)
    });
    position.scale = s;
    return position;
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle the shop basket button click.
   * @param {PointerEvent} event
   * @param {HTMLButtonElement} target
   */
  static async _onShopBasket(event, target) {
    const shop = this.document?.actor;
    if (!shop || !shop.isShop) {
      ui.notifications.warn(localize('ShopHUD.NoShopActor'));
      return;
    }

    // Collect actors owned by the current player
    const ownedActors = game.actors.filter(a =>
      a.isOwner && a.hasPlayerOwner && a.id !== shop.id
    );

    if (ownedActors.length === 0) {
      ui.notifications.warn(localize('ShopHUD.NoActorOwned'));
      return;
    }

    let targetActorId;

    if (ownedActors.length === 1) {
      targetActorId = ownedActors[0].id;
    } else {
      targetActorId = await ShopTokenHUD._showActorSelectDialog(ownedActors);
      if (!targetActorId) return; // User cancelled
    }

    // Store the target actor on the shop for this user
    await shop.setFlag(MODULE_ID, `targetActor.${game.user.id}`, targetActorId);

    // Open the shop sheet for the player
    const sheet = new ShopActorSheet(shop);
    sheet.render(true, { focus: true });
  }

  /**
   * Show a dialog for the player to pick which actor should shop.
   * @param {Actor[]} actors
   * @returns {Promise<string|null>}
   */
  static async _showActorSelectDialog(actors) {
    return new Promise((resolve) => {
      const content = actors.map(a =>
        `<option value="${a.id}">${a.name}</option>`
      ).join('');

      new Dialog({
        title: localize('ShopHUD.TargetActor'),
        content: `
          <p>${localize('ShopHUD.TargetActorPrompt')}</p>
          <div class="form-group">
            <select name="actorId" autofocus>${content}</select>
          </div>
        `,
        buttons: {
          select: {
            label: localize('ShopHUD.Select'),
            callback: (html) => {
              const actorId = html.find('[name="actorId"]').val();
              resolve(actorId || null);
            }
          },
          cancel: {
            label: game.i18n.localize('Cancel'),
            callback: () => resolve(null)
          }
        },
        default: 'select',
        close: () => resolve(null)
      }).render(true);
    });
  }
}
