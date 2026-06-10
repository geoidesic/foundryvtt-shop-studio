import { get, writable } from 'svelte/store';
import { isWritableStore } from '#runtime/svelte/store/util';
import { Strings } from '#runtime/util';
import { isIterable, safeAccess } from '#runtime/util/object';

/**
 * Creates a filter function to compare objects by a given property key against a regex test.
 * The returned function is also a writable Svelte store that builds a regex from the store's value.
 * This filter function can be used with DynArrayReducer and bound as a store to input elements.
 *
 * @param {string|Iterable<string>} properties - Property key to compare
 * @param {object} [opts] - Optional parameters
 * @param {boolean} [opts.caseSensitive=false] - When true regex test is case-sensitive
 * @return {function} The query string filter function with store capabilities
 */
export function createFilterQuery(properties, { caseSensitive = false, store } = {}) {
  let keyword = '';
  let regex;

  if (store !== void 0 && !isWritableStore(store)) {
    throw new TypeError(`createFilterQuery error: 'store' is not a writable store.`);
  }

  const storeKeyword = store ? store : writable(keyword);

  if (store) {
    const current = get(store);

    if (typeof current === 'string') {
      keyword = Strings.normalize(current);
      regex = new RegExp(RegExp.escape(keyword), caseSensitive ? '' : 'i');
    }
    else {
      store.set(keyword);
    }
  }

  /**
   * Filter function that tests data against the current regex
   * @param {object} data - Data object to test against regex
   * @return {boolean} Whether the data matches the filter
   */
  function filterQuery(data) {
    if (keyword === '' || !regex) {
      return true;
    }

    if (isIterable(properties)) {
      for (const property of properties) {
        const value = data?.[property];

        if (value !== undefined) {
          if (typeof value === 'boolean') {
            if (value.toString() === keyword) {
              return true;
            }
          } else {
            const normalizedValue = Strings.normalize(value);
            if (regex.test(normalizedValue)) {
              return true;
            }
          }
        }
      }

      return false;
    }

    const value = safeAccess(data, properties);

    if (value !== undefined) {
      if (typeof value === 'boolean') {
        return value.toString() === keyword;
      }

      const normalizedValue = Strings.normalize(value);
      return regex.test(normalizedValue);
    }

    return false;
  }

  /**
   * Subscribe to changes in the filter value
   * @param {function} handler - A callback function that accepts strings
   * @return {object} Returns an object with a subscribe method
   */
  filterQuery.subscribe = (handler) => {
    return storeKeyword.subscribe(handler);
  };

  /**
   * Set a new value for the filter
   * @param {string|boolean|Array<string>} value - A new value for the keyword/regex test
   * @return {void} Nothing
   */
  filterQuery.set = (value) => {
    if (Array.isArray(value)) {
      const pattern = value.map((v) => RegExp.escape(Strings.normalize(v))).join('|');
      keyword = value.join(', ');
      regex = new RegExp(pattern, caseSensitive ? '' : 'i');
    } else if (typeof value === 'string') {
      keyword = Strings.normalize(value);
      regex = new RegExp(RegExp.escape(keyword), caseSensitive ? '' : 'i');
    } else if (typeof value === 'boolean') {
      keyword = value.toString();
      regex = new RegExp(keyword, caseSensitive ? '' : 'i');
    }

    storeKeyword.set(keyword);
  };

  return filterQuery;
}
