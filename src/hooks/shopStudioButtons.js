import { MODULE_ID } from '~/src/helpers/constants';
import { safeGetSetting } from '~/src/helpers/utility';
import { getShopActorType } from '~/src/actors/ShopActor.js';
import {
  SHOP_FLAG_KEYS,
  SHOP_FLAG_SCOPE,
  SHOP_IDENTITY_KIND,
  DEFAULT_SHOP_CONFIGURATION
} from '~/src/constants/shopConstants';

const EVENT_HANDLERS = new Map();
const SHOP_DIALOG_TYPE = `${MODULE_ID}.shop`;
const SHOP_DIALOG_FIELD_ATTR = 'data-gss-shop-field';

function isCreateActorDialog(app) {
  const createNewActorLocalized = game.i18n.format('DOCUMENT.Create', {
    type: game.i18n.localize('DOCUMENT.Actor')
  });
  return app?.title === createNewActorLocalized;
}

function getDialogRootElement(app, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return null;
}

function getCreateActorForm(app, html) {
  const root = getDialogRootElement(app, html);
  if (!root) return null;
  if (root.matches?.('form#document-create')) return root;
  return root.querySelector('form#document-create') || root.querySelector('form');
}

function getSelectedType(form) {
  const selectedRadio = form.querySelector('input[name="type"]:checked');
  if (selectedRadio) return selectedRadio.value;

  const select = form.querySelector('select[name="type"]');
  return select?.value ?? null;
}

function setSelectedType(form, type) {
  const selectedRadio = form.querySelector(`input[name="type"][value="${type}"]`);
  if (selectedRadio) selectedRadio.checked = true;

  const select = form.querySelector('select[name="type"]');
  if (select) select.value = type;
}

function clearShopHiddenFields(form) {
  for (const node of form.querySelectorAll(`input[${SHOP_DIALOG_FIELD_ATTR}]`)) {
    node.remove();
  }
}

function ensureShopHiddenField(form, name, value, dataType = null) {
  let input = form.querySelector(`input[${SHOP_DIALOG_FIELD_ATTR}][name="${name}"]`);
  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.setAttribute(SHOP_DIALOG_FIELD_ATTR, '');
    form.appendChild(input);
  }

  input.value = value;
  if (dataType) {
    input.dataset.dtype = dataType;
  }
}

function applyShopCreationFields(form) {
  ensureShopHiddenField(form, 'flags.core.sheetClass', `${MODULE_ID}.ShopActorSheet`);
  ensureShopHiddenField(form, `flags.${SHOP_FLAG_SCOPE}.${SHOP_FLAG_KEYS.identity}.isShop`, 'true', 'Boolean');
  ensureShopHiddenField(form, `flags.${SHOP_FLAG_SCOPE}.${SHOP_FLAG_KEYS.identity}.kind`, SHOP_IDENTITY_KIND);
  ensureShopHiddenField(form, 'img', 'icons/environment/settlement/warehouse-crates.webp');
}

function applyShopDialogSelection(form) {
  const selectedType = getSelectedType(form);
  if (selectedType !== SHOP_DIALOG_TYPE) {
    clearShopHiddenFields(form);
    return false;
  }

  setSelectedType(form, getShopActorType());
  applyShopCreationFields(form);
  return true;
}

function addShopTypeToRadioList(form) {
  const list = form.querySelector('ol.unlist.card, ol.card, ol.unlist');
  const backingType = getShopActorType();
  const backingInput = form.querySelector(`input[name="type"][value="${backingType}"]`);
  if (!list || !backingInput) return;
  if (form.querySelector(`input[name="type"][value="${SHOP_DIALOG_TYPE}"]`)) return;

  const li = document.createElement('li');
  li.className = 'gss-shop-type-option';

  const label = document.createElement('label');
  const icon = document.createElement('img');
  icon.src = `modules/${MODULE_ID}/assets/shop-studio-logo-dragon-be7c41ff.webp`;
  icon.alt = game.i18n.localize(`${MODULE_ID}.ShopSheetTitle`);
  icon.width = 28;
  icon.height = 28;
  icon.style.border = 'none';

  const text = document.createElement('span');
  text.textContent = game.i18n.localize(`${MODULE_ID}.ShopSheetTitle`);

  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'type';
  input.value = SHOP_DIALOG_TYPE;
  input.required = true;

  label.append(icon, text, input);
  li.appendChild(label);

  const backingRow = backingInput.closest('li');
  if (backingRow?.parentNode) {
    backingRow.parentNode.insertBefore(li, backingRow.nextSibling);
  } else {
    list.appendChild(li);
  }
}

function addShopTypeToSelect(form) {
  const select = form.querySelector('select[name="type"]');
  if (!select) return;
  if (select.querySelector(`option[value="${SHOP_DIALOG_TYPE}"]`)) return;

  const option = document.createElement('option');
  option.value = SHOP_DIALOG_TYPE;
  option.textContent = game.i18n.localize(`${MODULE_ID}.ShopSheetTitle`);
  select.appendChild(option);
}

export function renderShopTypeInCreateActorApplication(app, html) {
  if (!game.modules.get(MODULE_ID)?.active) return;
  if (!isCreateActorDialog(app)) return;

  const form = getCreateActorForm(app, html);
  if (!form) return;

  addShopTypeToRadioList(form);
  addShopTypeToSelect(form);

  if (form.dataset.gssShopTypeBound === 'true') return;

  form.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button');
    if (!button || button.type === 'button') return;
    applyShopDialogSelection(form);
  }, true);

  form.addEventListener('submit', () => {
    applyShopDialogSelection(form);
  }, true);

  form.dataset.gssShopTypeBound = 'true';
}

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
  const appName = app?.constructor?.name ?? '';
  const isActorDirectory = appName.includes('ActorDirectory')
    || app?.collection === game.actors
    || app?.id === 'actors'
    || app?.tabName === 'actors';
  if (!isActorDirectory) return;

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
  try {
    // Count existing shops to derive an incrementing name
    const existingShops = game.actors.filter(a => a.isOwner && a.isShop);
    const shopNumber = existingShops.length + 1;
    const shopName = `Shop ${shopNumber}`;

    const shopActor = await Actor.create({
      name: shopName,
      type: getShopActorType(),
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
      img: 'icons/environment/settlement/warehouse-crates.webp'
    }, { renderSheet: true });
    ui.notifications.info(`New shop "${shopName}" created and opened.`);
  } catch (err) {
    ui.notifications.error('Failed to create shop actor.');
    console.error(err);
  }
}

export { createOrOpenShop };
