

import WelcomeAppShell from './WelcomeAppShell.svelte';
import { SvelteApplication } from "@typhonjs-fvtt/runtime/svelte/application";
import { MODULE_CODE, MODULE_ID, MODULE_TITLE } from "~/src/helpers/constants"
import { version } from "../../../module.json";

export default class WelcomeApplication extends SvelteApplication
{
   /**
    * Default Application options
    *
    * @returns {object} options - Application options.
    * @see https://foundryvtt.com/api/interfaces/client.ApplicationOptions.html
    */
   static get defaultOptions()
   {
      return foundry.utils.mergeObject(super.defaultOptions, {
         id: `${MODULE_ID}-welcome`,
         classes: [MODULE_ID, MODULE_CODE],
         resizable: true,
         minimizable: true,
         width: 320,
         height: 620,
         headerIcon: 'modules/foundryvtt-shop-studio/assets/shop-studio-logo-dragon-be7c41ff.webp',
         title: game.i18n.localize(`${MODULE_TITLE} v${version}`),
         svelte: {
            class: WelcomeAppShell,
            target: document.body,
            intro: true,
            props: {
               version  // A prop passed to HelloFoundryAppShell for the initial message displayed.
            }
         }
      });
   }
}
