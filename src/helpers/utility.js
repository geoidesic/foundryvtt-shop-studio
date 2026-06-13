
import { LOG_PREFIX, MODULE_ID, MODULE_CODE, LOG_PREFIX_COLOR, LOG_STYLES} from "~/src/helpers/constants"

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function isNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

export function ucfirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function camelCaseToTitleCase(camelCaseStr) {
  const words = camelCaseStr.replace(/([A-Z])/g, ' $1').trim();
  const titleCaseStr = words.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return titleCaseStr;
}

export function truncate(str, n) {
  return str.length > n ? str.substr(0, n - 1) + "..." : str;
}

export function getActorOwner(actor) {
  const owners = getOwners(actor);
  if (owners.length === 0) {
    return game.user;
  }
  if (owners.length === 1) {
    return owners[0];
  }

  let owner = owners.reduce((owner, currentOwner) => {
    if (!currentOwner.isGM) {
      owner = currentOwner;
    }
    return owner;
  }, null);

  if (!owner) {
    if (game.user.isGM) {
      return game.user;
    }
  }

  if (!owner) {
    return game.user;
  }

  return owner;
}

export function getGMs() {
  return game.users.filter(u => u.isGM).map(u => u.id)
}

/**
 * This is necessary because of a wierd context difference between foundry and svelte
 * Foundry's update method interprets dot notation as data nodes and so creates a nested data structure from it if you use it as a key
 * Svelte's stores do not, they use it as a string literal.
 * If you're trying to use actor uuid as a storage key then this conversion becomes necessary
 * @param {string} uuid 
 * @returns {string} replaces dots with underscores
 */
export function encodeUuidString(uuid) {
  return uuid.replace(/\./g, "_");
}
export function decodeUuidString(uuid) {
  return uuid.replace(/_/g, "\.");
}

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Toggles the bookmark/favorite status of an item
 * @param {Item} item - The item to toggle
 * @param {Function} callback - Callback function to run after toggle
 * @return {Promise<void>} A promise that resolves when the item is updated
 */
export async function toggleBookmark(item, callback = () => { }) {
  await item.update({ system: { favourite: !item.system.favourite } });
  callback();
}

/**
 * Gets a localized string
 * @param {string} string - The string to localize
 * @return {string} The localized string
 */
export function localize(string) {
  if (typeof game === 'undefined') return string; //- avoid lint error
  return game.i18n.localize(`${MODULE_ID}.${string}`);
}

/**
 * Safely get a game setting with fallback
 */
export function safeGetSetting(moduleId, key, defaultValue = true) {
  try {
    const setting = game.settings.get(moduleId, key);
    return setting !== undefined ? setting : defaultValue;
  } catch (err) {
    return defaultValue;
  }
}

/**
 * Gets the appropriate TextEditor API for the current Foundry version.
 * @returns {object} The TextEditor API implementation
 */
export function getTextEditorAPI() {
  if (Number(game.version) >= 13) {
    return foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
  }
  return TextEditor;
}

/**
 * Enriches HTML content using the appropriate TextEditor API for the current Foundry version.
 * @param {string} content - The HTML content to enrich
 * @param {object} [options] - Enrichment options
 * @returns {string} The enriched HTML content
 */
export function enrichHTML(content, options = {}) {
  const textEditor = getTextEditorAPI();
  return textEditor.enrichHTML(content, options);
}



export const log = {
  ASSERT: 1, ERROR: 2, WARN: 3, INFO: 4, DEBUG: 5, VERBOSE: 6,
  set level(level) {
    this.a = (level >= this.ASSERT) ? console.assert.bind(window.console, LOG_PREFIX) : () => { };
    this.e = (level >= this.ERROR) ? console.error.bind(window.console, LOG_PREFIX) : () => { };
    this.w = (level >= this.WARN) ? console.warn.bind(window.console, LOG_PREFIX) : () => { };
    this.i = (level >= this.INFO) ? console.info.bind(window.console, LOG_PREFIX) : () => { };
    this.d = (level >= this.DEBUG) ? console.debug.bind(window.console, LOG_PREFIX) : () => { };
    this.v = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX) : () => { };

    // Colorized log methods - short versions
    this.s = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.s) : () => { };
    this.q = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.q) : () => { };
    this.p = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.p) : () => { };
    this.g = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.g) : () => { };
    this.go = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.go) : () => { };
    this.r = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.r) : () => { };
    this.o = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.o) : () => { };
    this.b = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.b) : () => { };
    this.y = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.y) : () => { };
    this.c = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.c) : () => { };
    this.m = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.m) : () => { };
    this.gr = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.gr) : () => { };
    this.br = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.br) : () => { };
    this.pi = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.pi) : () => { };
    this.t = (level >= this.VERBOSE) ? console.log.bind(window.console, LOG_PREFIX_COLOR, LOG_STYLES.t) : () => { };

    // Colorized log methods - full name aliases
    this.goldenrod = this.s;
    this.steelblue = this.go;
    this.aqua = this.q;
    this.purple = this.p;
    this.green = this.g;
    this.red = this.r;
    this.orange = this.o;
    this.blue = this.b;
    this.yellow = this.y;
    this.cyan = this.c;
    this.magenta = this.m;
    this.gray = this.gr;
    this.brown = this.br;
    this.pink = this.pi;
    this.teal = this.t;

    this.loggingLevel = level;
  },
  get level() { return this.loggingLevel; }
};