import { MODULE_ID } from '~/src/helpers/constants';
import { safeGetSetting } from '~/src/helpers/utility';
import {
  SHOP_ACTOR_TYPE,
  SHOP_FLAG_KEYS,
  SHOP_FLAG_SCOPE,
  SHOP_IDENTITY_KIND,
  DEFAULT_SHOP_CONFIGURATION
} from '~/src/actors/ShopActor';

const EVENT_HANDLERS = new Map();

function cleanupEventHandlers(elementId) {
  if (EVENT_HANDLERS.has(elementId)) {
    const handlers = EVENT_HANDLERS.get(elementId);
    for (const [el, type, handler] of handlers) {
      el.removeEventListener(type, handler);
    }
    EVENT_HANDLERS.delete(elementId);
  }
}

function storeEventHandler(elementId, element, type, handler) {
  if (!EVENT_HANDLERS.has(elementId)) {
    EVENT_HANDLERS.set(elementId, []);
  }
  EVENT_HANDLERS.get(elementId).push([element, type, handler]);
}

function getShopStudioButton(buttonId) {
  const button = document.createElement('button');
  button.id = buttonId;
  button.type = 'button';
  button.className = 'dialog-button default bright';
  button.setAttribute('data-shop-start', '');
  button.setAttribute('tabindex', '0');

  const img = document.createElement('img');
  img.src = `modules/${MODULE_ID}/assets/shop-studio-be7c41ff.webp`;
  img.alt = 'Shop Studio';
  img.style.height = '100%';
  img.style.maxHeight = '30px';
  img.style.border = 'none';
  img.style.width = 'auto';
  button.appendChild(img);

  return button;
}

export const renderShopStudioSidebarButton = (app) => {
  if (!game.modules.get(MODULE_ID)?.active) return;
  if (!safeGetSetting(MODULE_ID, 'showButtonInSideBar', true)) return;
  if (!app || (app.constructor.name !== "ActorDirectory" && app.constructor.name !== "ActorDirectoryV2")) return;

  const element = game.version >= 13 ? app.element : (app._element || app.element || $(app.element));
  if (!element) return;

  const elementId = `shop-sidebar-${app.id || 'default'}`;
  cleanupEventHandlers(elementId);

  // Remove any existing button
  const existingSelector = '#geoidesic-shop-studio-sidebar-button';
  if (game.version >= 13) {
    const existing = element.querySelector(existingSelector);
    if (existing) existing.remove();
  } else if (typeof $ !== 'undefined') {
    element.find(existingSelector).remove();
  }

  const shopButton = getShopStudioButton('geoidesic-shop-studio-sidebar-button');

  if (game.version >= 13) {
    let headerActions = element.querySelector('header.directory-header .header-actions');
    if (!headerActions) {
      headerActions = element.querySelector('.directory-header .header-actions');
    }
    if (headerActions && headerActions.parentNode) {
      headerActions.parentNode.insertBefore(shopButton, headerActions.nextSibling);
    } else {
      const header = element.querySelector('header.directory-header, .directory-header');
      if (header) header.append(shopButton);
    }
  } else if (typeof $ !== 'undefined') {
    const header = element.find('header.directory-header');
    if (header.length > 0) {
      header.append(shopButton);
    }
  }

  const clickHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    Hooks.callAll('gss.openShopStudio');
    // Default action: create or open a shop actor
    createOrOpenShop();
  };

  shopButton.addEventListener('click', clickHandler);
  storeEventHandler(elementId, shopButton, 'click', clickHandler);
};

async function createOrOpenShop() {
  let shopActor = game.actors.find(a => a.isOwner && a.isShop);
  if (!shopActor) {
    try {
      shopActor = await Actor.create({
        name: game.i18n.localize('foundryvtt-shop-studio.ShopSheetTitle') || "New Shop",
        type: SHOP_ACTOR_TYPE,
        flags: {
          core: {
            sheetClass: `${MODULE_ID}.ShopActorSheet`
          },
          [SHOP_FLAG_SCOPE]: {
            [SHOP_FLAG_KEYS.identity]: {
              isShop: true,
              kind: SHOP_IDENTITY_KIND
            },
            [SHOP_FLAG_KEYS.configuration]: DEFAULT_SHOP_CONFIGURATION
          }
        },
        img: `modules/${MODULE_ID}/assets/shop-studio-logo-dragon-be7c41ff.webp`
      }, { renderSheet: true });
      ui.notifications.info('New shop created and opened.');
    } catch (err) {
      ui.notifications.error('Failed to create shop actor.');
      console.error(err);
    }
  } else {
    if (shopActor.getFlag('core', 'sheetClass') !== `${MODULE_ID}.ShopActorSheet`) {
      await shopActor.setFlag('core', 'sheetClass', `${MODULE_ID}.ShopActorSheet`);
    }
    shopActor.sheet.render(true, { focus: true });
  }
}

export { createOrOpenShop };