import { MODULE_ID, DEFAULT_ITEM_SOURCES, DEFAULT_LISTABLE_ITEM_TYPES } from '~/src/helpers/constants';
import { safeGetSetting } from '~/src/helpers/utility';

export const ITEM_SOURCES_SETTING = 'itemSources';
export const LISTABLE_ITEM_TYPES_SETTING = 'listableItemTypes';

/**
 * Get the item subtypes currently exposed by the active game system.
 * @returns {Array<{type: string, label: string}>}
 */
export function getAvailableItemTypes() {
  const configured = CONFIG?.Item?.typeLabels ?? {};
  const documentTypes = Array.isArray(game?.documentTypes?.Item) ? game.documentTypes.Item : [];
  const modelTypes = CONFIG?.Item?.dataModels ? Object.keys(CONFIG.Item.dataModels) : [];
  const metadataTypes = CONFIG?.Item?.documentClass?.metadata?.types ?? [];
  const legacyTypes = Array.isArray(CONFIG?.Item?.types) ? CONFIG.Item.types : [];
  const compendiumTypes = game.packs
    ?.filter((pack) => pack.documentName === 'Item')
    .flatMap((pack) => Array.from(pack.index?.values?.() ?? []).map((entry) => entry?.type)) ?? [];

  return Array.from(new Set([
    ...Object.keys(configured),
    ...documentTypes,
    ...modelTypes,
    ...metadataTypes,
    ...legacyTypes,
    ...compendiumTypes
  ]))
    .filter(Boolean)
    .map((type) => ({ type, label: getItemTypeLabel(type) }))
    .sort((a, b) => a.label.localeCompare(b.label, game.i18n?.lang));
}

/**
 * Get the localized label for an item subtype.
 * @param {string} type - The item subtype.
 * @returns {string}
 */
export function getItemTypeLabel(type) {
  const rawLabel = CONFIG?.Item?.typeLabels?.[type] || CONFIG?.Item?.typeHints?.[type];
  if (rawLabel) return game.i18n.localize(rawLabel);

  try {
    return game.i18n.localize(type);
  } catch (_) {
    return type;
  }
}

/**
 * Get all Item compendiums available to the current game.
 * @returns {Array}
 */
export function getAllItemCompendia() {
  return game.packs?.filter((pack) => pack.documentName === 'Item') ?? [];
}

/**
 * Get configured Item compendium packs for Shop Studio.
 * @returns {Array}
 */
export function getItemSourcePacks() {
  const configured = safeGetSetting(MODULE_ID, ITEM_SOURCES_SETTING, DEFAULT_ITEM_SOURCES);
  const collections = Array.isArray(configured) ? configured : configured?.items;
  if (!Array.isArray(collections)) return [];

  return collections
    .map((collection) => game.packs?.get(collection))
    .filter((pack) => pack?.documentName === 'Item');
}

/**
 * Get item types allowed to be listed in the store.
 * A null/default setting means "all current item types".
 * @returns {Array<{type: string, label: string}>}
 */
export function getConfiguredListableItemTypes() {
  const configured = safeGetSetting(MODULE_ID, LISTABLE_ITEM_TYPES_SETTING, DEFAULT_LISTABLE_ITEM_TYPES);
  const available = getAvailableItemTypes();

  if (configured === null || configured === undefined) return available;
  if (!Array.isArray(configured)) return [];

  const allowed = new Set(configured);
  return available.filter((entry) => allowed.has(entry.type));
}

/**
 * Check whether an item subtype should be listable in the store.
 * @param {string} type - The item subtype.
 * @returns {boolean}
 */
export function isItemTypeListable(type) {
  const configured = safeGetSetting(MODULE_ID, LISTABLE_ITEM_TYPES_SETTING, DEFAULT_LISTABLE_ITEM_TYPES);
  if (configured === null || configured === undefined) return true;
  return Array.isArray(configured) && configured.includes(type);
}

/**
 * True if at least one Item compendium source is configured.
 * @returns {boolean}
 */
export function hasItemSourcesAssigned() {
  return getItemSourcePacks().length > 0;
}

/**
 * Auto-assign every Item compendium as a shop source.
 * @returns {string[]}
 */
export function autoAssignItemSources() {
  return getAllItemCompendia()
    .map((pack) => pack.collection);
}
