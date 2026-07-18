import '~/src/styles/Variables.sass'; // Import any styles as this includes them in the build.
import '~/src/styles/init.sass'; // Import any styles as this includes them in the build.

import WelcomeApplication from '~/src/components/pages/WelcomeApplication.js';
import ShopActorSheet from '~/src/sheets/ShopActorSheet';
import { getShopActorType, registerShopActor, SHOP_ACTOR_TYPE, LEGACY_SHOP_ACTOR_TYPE } from '~/src/actors/ShopActor';
import { SHOP_FLAG_SCOPE, SHOP_FLAG_KEYS, SHOP_IDENTITY_KIND, DEFAULT_SHOP_CONFIGURATION } from '~/src/constants/shopConstants';
import { MODULE_ID } from '~/src/helpers/constants';
import { log, safeGetSetting } from '~/src/helpers/utility';
import { registerSettings } from '~/src/settings';
import { renderShopStudioSidebarButton, renderShopTypeInCreateActorApplication } from '~/src/hooks/shopStudioButtons.js';
import { onRenderTokenHUD } from '~/src/hud/shopHUD.js';
import { registerSocket } from '~/src/helpers/shopSocket.js';

window.GAS = window.GAS || {};

Hooks.once("init", (app, html, data) => {
  window.GAS.log = log;
  window.GAS.log.level = log.VERBOSE;
  window.GAS.log.g('Initialising');
  CONFIG.debug.hooks = true;

  registerSocket();
  registerShopActor();

  // Register preCreateDocument hook (runs after type validation)
  Hooks.on("preCreateDocument", (data, options, user) => {
    const isShopType = data.type === `${MODULE_ID}.shop` || 
                      (data.flags?.[SHOP_FLAG_SCOPE]?.[SHOP_FLAG_KEYS.identity]?.kind === SHOP_IDENTITY_KIND);
    
    if (isShopType) {
      data.type = SHOP_ACTOR_TYPE; // 'npc'
      
      // Ensure all required flags are set
      data.flags = data.flags ?? {};
      data.flags.core = data.flags.core ?? {};
      data.flags.core.sheetClass = `${MODULE_ID}.ShopActorSheet`;
      
      data.flags[SHOP_FLAG_SCOPE] = data.flags[SHOP_FLAG_SCOPE] ?? {};
      data.flags[SHOP_FLAG_SCOPE][SHOP_FLAG_KEYS.identity] = {
        isShop: true,
        kind: SHOP_IDENTITY_KIND
      };
      
      // Ensure default configuration exists
      if (!data.flags[SHOP_FLAG_SCOPE][SHOP_FLAG_KEYS.configuration]) {
        data.flags[SHOP_FLAG_SCOPE][SHOP_FLAG_KEYS.configuration] = DEFAULT_SHOP_CONFIGURATION;
      }
      
      // Set default shop image
      data.img = 'icons/environment/settlement/warehouse-crates.webp';
    }
  });

  CONFIG.Actor.typeLabels ??= {};
  if (!CONFIG.Actor.typeLabels[LEGACY_SHOP_ACTOR_TYPE]) {
    CONFIG.Actor.typeLabels[LEGACY_SHOP_ACTOR_TYPE] = 'Shop (Legacy)';
  }

  // Register the Actor Sheet. The API differs between Foundry versions:
  // - V12: Actors.registerSheet(scope, sheetClass, { types, makeDefault, label })
  // - V13+: foundry.documents.collections.Actors.registerSheet(scope, sheetClass, { types, makeDefault, label })
  const sheetTypes = [...new Set([getShopActorType(), SHOP_ACTOR_TYPE, LEGACY_SHOP_ACTOR_TYPE])];
  if (game.version >= 13) {
    foundry.documents.collections.Actors.registerSheet(MODULE_ID, ShopActorSheet, {
      types: sheetTypes,
      makeDefault: false,
      label: 'Shop Studio'
    });
  } else {
    Actors.registerSheet(MODULE_ID, ShopActorSheet, {
      types: sheetTypes,
      makeDefault: false,
      label: 'Shop Studio'
    });
  }

  if(game.version > 13) {
    // V12 -> 13 SHIM
    window.MIN_WINDOW_WIDTH = 200;
    window.MIN_WINDOW_HEIGHT = 50;
  }
  
  registerSettings(app);

});

Hooks.once("ready", (app, html, data) => {
  window.GAS.log.g('GSS ready hook');
  if (!game.modules.get(MODULE_ID).active) {
    window.GAS.log.w('GSS Module is not active');
    return;
  }
  if (!safeGetSetting(MODULE_ID, 'dontShowWelcome', false)) {
    new WelcomeApplication().render(true, { focus: true });
  }
  registerSettings(app); // ✅ Now in ready phase
});

// Settings config UI grouping
Hooks.on('renderSettingsConfig', (app, html, context) => {
  if (game.user.isGM) {
    // Add UI settings heading for the module
    const uiSettingElement = $(`[data-setting-id="${MODULE_ID}.showButtonInSideBar"]`, html);
    if (uiSettingElement.length) {
      uiSettingElement.before(
        `<h4 class="gas-settings-h4">${game.i18n.localize(`${MODULE_ID}.Setting.UI.Name`)}</h4>`
      );
    }
  }
});

/** 
 * Handle rendering the Shop Studio button in the Sidebar Actor Directory
 */
//- For Foundry V13+
Hooks.on('activateActorDirectory', async (app) => {
  renderShopStudioSidebarButton(app);
});
//- For Foundry V12
Hooks.on('renderActorDirectory', async (app, html) => {
  renderShopStudioSidebarButton(app, html);
});

// Add a Shop option in the Create Actor dialog and map it to npc + shop identity flags.
Hooks.on('renderApplication', (app, html) => {
  renderShopTypeInCreateActorApplication(app, html);
});

Hooks.on('renderApplicationV2', (app, html) => {
  renderShopTypeInCreateActorApplication(app, html);
});

// Inject shop basket button into TokenHUD for shop tokens
Hooks.on('renderTokenHUD', onRenderTokenHUD);

Hooks.on('gss.openShopStudio', () => {
  window.GAS.log.i('Shop Studio opened via sidebar button');
  // Can be extended for more complex open logic
});
