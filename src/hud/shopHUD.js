import { MODULE_ID } from '~/src/helpers/constants';
import { SHOP_IDENTITY_KIND } from '~/src/constants/shopConstants';

/**
 * Hooks into renderTokenHUD to add shop-specific controls when a shop
 * token is hovered. Does NOT replace CONFIG.Token.hudClass.
 *
 * @param {ApplicationV2} app   The TokenHUD application instance
 * @param {jQuery} html         The rendered HUD jQuery element
 * @param {object} data         The render context data
 */
export function onRenderTokenHUD(app, html, data) {
  const token = app.object;
  if (!token) { console.log('[ShopHUD] bail: no app.object'); return; }
  const actor = token.document?.actor;
  if (!actor) { console.log('[ShopHUD] bail: no actor'); return; }
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) { console.log('[ShopHUD] bail: no HUD root'); return; }

  const flagIdentity = actor.getFlag(MODULE_ID, 'identity');
  const isShop = actor.isShop === true
    || flagIdentity?.isShop === true
    || flagIdentity?.kind === SHOP_IDENTITY_KIND;

  if (!isShop) { console.log('[ShopHUD] bail: not a shop', { flagIdentity }); return; }

  // Apply shop-specific HUD stripping while leaving the custom open button disabled.

  // Hide irrelevant controls for shop tokens — replace all three columns
  const leftCol = root.querySelector('.col.left');
  const midCol = root.querySelector('.col.middle');
  const rightCol = root.querySelector('.col.right');

  // Keep only lock + config in left, hide everything else
  if (leftCol) {
    leftCol.querySelectorAll('.attribute.elevation, .control-icon[data-action="sort"], '
      + '.control-icon[data-action="togglePalette"], .palette').forEach((node) => node.remove());
    if (!game.user.isGM) leftCol.querySelectorAll('.control-icon[data-action="locked"]').forEach((node) => node.remove());
    if (!game.user.isGM) leftCol.querySelectorAll('.control-icon[data-action="config"]').forEach((node) => node.remove());
  }

  // Hide bar displays completely
  if (midCol) midCol.replaceChildren();

  // Hide effects, movement, target, combat from right column; keep visibility for GM
  if (rightCol) {
    rightCol.querySelectorAll('.control-icon[data-action="togglePalette"], .palette, '
      + '.control-icon[data-action="target"], .control-icon[data-action="combat"]').forEach((node) => node.remove());
    if (!game.user.isGM) rightCol.querySelectorAll('.control-icon[data-action="visibility"]').forEach((node) => node.remove());

    /*
     * Disabled by request: the HUD shop-basket/open control is not useful
     * for non-owner players and duplicates token double-click behavior.
     *
     * const basketBtn = document.createElement('button');
     * basketBtn.type = 'button';
     * basketBtn.className = 'control-icon shop-basket-icon';
     * basketBtn.dataset.tooltip = localize('ShopHUD.Basket');
     * basketBtn.setAttribute('aria-label', localize('ShopHUD.Basket'));
     * basketBtn.innerHTML = `
     *   <img src="modules/${MODULE_ID}/assets/shop-studio-be7c41ff.webp"
     *        alt="${localize('ShopHUD.Basket')}" width="32" height="32">
     * `;
     *
     * basketBtn.addEventListener('click', async (event) => {
     *   event.preventDefault();
     *   event.stopPropagation();
     *   await handleBasketClick(actor);
     * });
     *
     * rightCol.prepend(basketBtn);
     */
  }
}

/**
 * Handle the basket button click: pick target actor, open shop.
 */
/*
async function handleBasketClick(shop) {
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
    targetActorId = await showActorSelectDialog(ownedActors);
    if (!targetActorId) return;
  }

  await shop.setFlag(MODULE_ID, `targetActor.${game.user.id}`, targetActorId);

  const sheet = new ShopActorSheet(shop);
  sheet.render(true, { focus: true });
}
*/

/**
 * Show a dialog for the player to pick which of their owned actors to shop with.
 */
/*
function showActorSelectDialog(actors) {
  return new Promise((resolve) => {
    const options = actors.map(a =>
      `<option value="${a.id}">${a.name}</option>`
    ).join('');

    new Dialog({
      title: localize('ShopHUD.TargetActor'),
      content: `
        <p>${localize('ShopHUD.TargetActorPrompt')}</p>
        <div class="form-group">
          <select name="actorId" autofocus>${options}</select>
        </div>
      `,
      buttons: {
        select: {
          label: localize('ShopHUD.Select'),
          callback: (html) => resolve(html?.querySelector('[name="actorId"]')?.value || null)
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
*/
