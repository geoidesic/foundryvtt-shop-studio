import '~/src/styles/Variables.sass'; // Import any styles as this includes them in the build.
import '~/src/styles/init.sass'; // Import any styles as this includes them in the build.

import WelcomeApplication from '~/src/components/pages/WelcomeApplication.js';
import ShopActorSheet from '~/src/sheets/ShopActorSheet';
import { getShopActorType, registerShopActor, SHOP_ACTOR_TYPE, LEGACY_SHOP_ACTOR_TYPE } from '~/src/actors/ShopActor';
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

  CONFIG.Actor.typeLabels ??= {};
  if (!CONFIG.Actor.typeLabels[LEGACY_SHOP_ACTOR_TYPE]) {
    CONFIG.Actor.typeLabels[LEGACY_SHOP_ACTOR_TYPE] = 'Shop (Legacy)';
  }

  foundry.documents.collections.Actors.registerSheet(MODULE_ID, ShopActorSheet, {
    types: [...new Set([getShopActorType(), SHOP_ACTOR_TYPE, LEGACY_SHOP_ACTOR_TYPE])],
    makeDefault: false,
    label: 'Shop Studio'
  });

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
