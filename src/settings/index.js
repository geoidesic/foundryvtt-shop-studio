import { log } from '~/src/helpers/utility';
import { MODULE_ID } from '~/src/helpers/constants';


export function registerSettings(app) {
  log.i("Building module settings");

  /** World Settings */
  debugSetting();
  debugHooksSetting();
  /** User settings */
  dontShowWelcome()

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
