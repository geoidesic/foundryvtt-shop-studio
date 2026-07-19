import { MODULE_ID } from '~/src/helpers/constants';
import ItemSourcesButton from './ItemSourcesButton';


export function registerSettings(app) {
  window.GAS.log.g("Building module settings");

  /** World Settings */
  debugSetting();
  debugHooksSetting();
  registerUISettings();
  registerItemSourcesSettings();
  registerVendorFundsSettings();
  /** User settings */
  dontShowWelcome()

}

function registerUISettings() {
  game.settings.register(MODULE_ID, 'showButtonInSideBar', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.showButtonInSideBar.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.showButtonInSideBar.Hint`),
    scope: 'world',
    config: true,
    default: true,
    type: Boolean,
  });
}

function registerItemSourcesSettings() {
  game.settings.register(MODULE_ID, 'itemSources', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.ItemSources.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.ItemSources.Hint`),
    scope: 'world',
    config: false,
    default: [],
    type: Array,
  });

  game.settings.register(MODULE_ID, 'listableItemTypes', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.ItemSources.ListableItemTypesName`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.ItemSources.ListableItemTypesHint`),
    scope: 'world',
    config: false,
    default: null,
    type: Array,
  });

  game.settings.register(MODULE_ID, 'itemSourcesShowSelectedOnly', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.ItemSources.ShowSelectedOnlyName`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.ItemSources.ShowSelectedOnlyHint`),
    scope: 'world',
    config: false,
    default: false,
    type: Boolean,
  });

  game.settings.registerMenu(MODULE_ID, 'itemSources', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.ItemSources.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.ItemSources.Hint`),
    label: game.i18n.localize(`${MODULE_ID}.Setting.ItemSources.Label`),
    icon: 'fas fa-atlas',
    type: ItemSourcesButton,
    restricted: true,
  });
}

function dontShowWelcome() {
  game.settings.register(MODULE_ID, 'dontShowWelcome', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.DontShowWelcome.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.DontShowWelcome.Hint`),
    scope: 'user',
    config: true,
    default: false,
    type: Boolean,
  });
}

function registerVendorFundsSettings() {
  game.settings.register(MODULE_ID, 'defaultVendorFunds', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.DefaultVendorFunds.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.DefaultVendorFunds.Hint`),
    scope: 'world',
    config: true,
    default: 0,
    type: Number,
  });

  game.settings.register(MODULE_ID, 'sellResolutionMode', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.SellResolutionMode.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.SellResolutionMode.Hint`),
    scope: 'world',
    config: true,
    default: 'gm',
    type: String,
    choices: {
      gm: game.i18n.localize(`${MODULE_ID}.Setting.SellResolutionMode.GM`),
      player: game.i18n.localize(`${MODULE_ID}.Setting.SellResolutionMode.Player`),
    },
  });

  game.settings.register(MODULE_ID, 'sellQuantityMode', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.SellQuantityMode.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.SellQuantityMode.Hint`),
    scope: 'world',
    config: true,
    default: 'prompt',
    type: String,
    choices: {
      prompt: game.i18n.localize(`${MODULE_ID}.Setting.SellQuantityMode.Prompt`),
      default1: game.i18n.localize(`${MODULE_ID}.Setting.SellQuantityMode.Default1`),
    },
  });
}


function debugSetting() {
  game.settings.register(MODULE_ID, 'debug', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.Debug.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.Debug.Hint`),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      Dialog.confirm({
        title: game.i18n.localize(`${MODULE_ID}.Setting.ReloadRequiredTitle`),
        content: `<p>${game.i18n.localize(`${MODULE_ID}.Setting.ReloadRequiredContent`)}</p>`,
        yes: () => window.location.reload(),
        no: () => {},
        defaultYes: true
      });
    }
  });
}
function debugHooksSetting() {
  game.settings.register(MODULE_ID, 'debug.hooks', {
    name: game.i18n.localize(`${MODULE_ID}.Setting.DebugHooks.Name`),
    hint: game.i18n.localize(`${MODULE_ID}.Setting.DebugHooks.Hint`),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: () => {
      Dialog.confirm({
        title: game.i18n.localize(`${MODULE_ID}.Setting.ReloadRequiredTitle`),
        content: `<p>${game.i18n.localize(`${MODULE_ID}.Setting.ReloadRequiredContent`)}</p>`,
        yes: () => window.location.reload(),
        no: () => {},
        defaultYes: true
      });
    }
  });
}
