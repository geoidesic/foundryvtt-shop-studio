import { writable } from 'svelte/store';
import {
  getConfiguredListableItemTypes,
  getItemSourcePacks,
  isItemTypeListable
} from '~/src/helpers/itemSources';

export const catalogItems = writable([]);
export const catalogLoading = writable(false);
export const catalogError = writable(null);

/**
 * Extract a nested value from an enhanced compendium index entry.
 * @param {object} entry - The index entry.
 * @param {string} path - The dotted path to read.
 * @returns {unknown}
 */
function getNestedProperty(entry, path) {
  return path.split('.').reduce((value, key) => value?.[key], entry);
}

/**
 * Set a nested value on a plain object.
 * @param {object} target - The target object.
 * @param {string} path - The dotted path to write.
 * @param {unknown} value - The value to set.
 */
function setNestedProperty(target, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const parent = keys.reduce((current, key) => {
    current[key] ??= {};
    return current[key];
  }, target);
  parent[lastKey] = value;
}

/**
 * Extract item data from a compendium index entry.
 * @param {CompendiumCollection} pack - The source compendium.
 * @param {Array} entries - The compendium index entries.
 * @returns {Array<object>}
 */
function extractPackItems(pack, entries) {
  const nonIndexKeys = [
    'system.price',
    'system.price.value',
    'system.price.denomination',
    'system.price.per',
    'system.quantity'
  ];

  return entries.map((entry) => {
    const item = {
      _id: entry._id,
      name: entry.name,
      img: entry.img,
      type: entry.type,
      uuid: entry.uuid,
      packName: pack.metadata.name,
      packLabel: pack.metadata.label,
      packPath: pack.metadata.path,
      sourcePack: pack.metadata.label
    };

    for (const key of nonIndexKeys) {
      if (entry[key] !== undefined) {
        setNestedProperty(item, key, entry[key]);
      } else {
        setNestedProperty(item, key, getNestedProperty(entry, key));
      }
    }

    return item;
  });
}

/**
 * Load listable Item compendium entries into the catalog store.
 * @returns {Promise<Array<object>>}
 */
export async function loadCatalogItems() {
  const packs = getItemSourcePacks();
  const allowedTypes = getConfiguredListableItemTypes().map((entry) => entry.type);

  catalogLoading.set(true);
  catalogError.set(null);

  try {
    const nonIndexKeys = [
      'system.price',
      'system.price.value',
      'system.price.denomination',
      'system.price.per',
      'system.quantity'
    ];

    const loadedItems = [];

    for (const pack of packs) {
      const index = await pack.getIndex({ fields: nonIndexKeys });
      loadedItems.push(...extractPackItems(pack, Array.from(index.entries())));
    }

    const listableItems = loadedItems
      .filter((item) => isItemTypeListable(item.type))
      .sort((a, b) => a.name?.localeCompare(b.name, game.i18n?.lang) ?? 0);

    const seen = new Set();
    const dedupedItems = [];
    for (const item of listableItems) {
      const key = item.uuid || `${item.packPath}.${item._id}`;
      if (!seen.has(key)) {
        dedupedItems.push(item);
        seen.add(key);
      }
    }

    catalogItems.set(dedupedItems);
    return dedupedItems;
  } catch (error) {
    catalogError.set(error?.message ?? String(error));
    catalogItems.set([]);
    return [];
  } finally {
    catalogLoading.set(false);
  }
}

/**
 * Reset catalog state without reloading compendium data.
 */
export function resetCatalogItems() {
  catalogItems.set([]);
  catalogError.set(null);
}
