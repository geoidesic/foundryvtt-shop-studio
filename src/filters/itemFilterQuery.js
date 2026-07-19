import { get, writable } from 'svelte/store';
import { isWritableStore } from "#runtime/svelte/store/util";
import { Strings } from "#runtime/util";
import { isIterable } from "#runtime/util/object";
import { stepwiseResolveDotpath } from '~/src/helpers/paths';

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

  // If an existing store is provided then set initial values.
  if (store) {
    const current = get(store);

    if (typeof current === 'string') {
      keyword = Strings.normalize(current);
      window.GAS.log.d('keyword', keyword);
      regex = new RegExp(RegExp.escape(keyword), caseSensitive ? '' : 'i');
      window.GAS.log.d('keyword', regex);
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
      window.GAS.log.d('No keyword or regex, returning true');
      return true; 
    }

    if (isIterable(properties)) {
      // console.log('isIterable')
      for (const property of properties) {
        const value = data?.[property];
        // window.GAS.log.d('Checking property:', property, 'with value:', value);
        
        // Check if value is defined
        if (value !== undefined) {
          // Handle boolean values directly
          if (typeof value === 'boolean') {
            // window.GAS.log.d('Boolean value found:', value);
            if (value.toString() === keyword) {
              // window.GAS.log.d('Match found for boolean:', value);
              return true; 
            }
          } else {
            // Normalize string values
            const normalizedValue = Strings.normalize(value);
            // window.GAS.log.d('Normalized value:', normalizedValue);
            if (regex.test(normalizedValue)) { 
              // window.GAS.log.d('Match found for normalized value:', normalizedValue);
              return true; 
            }
          }
        } else {
          // window.GAS.log.d('Value is undefined for property:', property);
        }
      }
      // window.GAS.log.d('No matches found in iterable properties');
      return false;
    }
    else {
      // Handle the single property case
      const steps = stepwiseResolveDotpath(data, properties);
      const value = steps[steps.length - 1].val; // Get the final value from the resolved steps
      // window.GAS.log.d('Checking single property:', properties, 'with value:', value);
      
      // Check if value is defined
      if (value !== undefined) {
        // Handle boolean values directly
        if (typeof value === 'boolean') {
          // window.GAS.log.d('Boolean value found in single property:', value);
          return value.toString() === keyword; // Compare boolean as string
        }
        // Normalize string values
        const normalizedValue = Strings.normalize(value);
        // window.GAS.log.d('Normalized value for single property:', normalizedValue);
        return regex.test(normalizedValue);
      }
      // window.GAS.log.d('Value is undefined for single property:', properties);
      return false; // Return false if value is undefined
    }
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
    if (game?.system?.log?.d) {
      window.GAS.log.d('value', value);
    }

    if (Array.isArray(value)) {
      // Join the array into a regex pattern
      const pattern = value.map(v => RegExp.escape(Strings.normalize(v))).join('|');
      keyword = value.join(', '); // Store the original values for reference
      regex = new RegExp(pattern, caseSensitive ? '' : 'i');
    } else if (typeof value === 'string') {
      keyword = Strings.normalize(value);
      if (game?.system?.log?.d) {
        window.GAS.log.d('keyword', keyword);
      }
      regex = new RegExp(RegExp.escape(keyword), caseSensitive ? '' : 'i');
    } else if (typeof value === 'boolean') {
      keyword = value.toString(); // Convert boolean to string
      regex = new RegExp(keyword, caseSensitive ? '' : 'i'); // Create regex for boolean string
    }
    
    storeKeyword.set(keyword);
  };

  return filterQuery;
}

/**
 * Creates a sort comparator that is also a writable Svelte store holding the active
 * sort state (`{ key, direction }`). The comparator resolves values via dotpath so it
 * can sort by nested fields like `system.quantity` as well as top-level fields like `name`.
 * Numeric values are compared numerically; everything else falls back to a locale-aware
 * string comparison. Direction may be `'asc'` or `'desc'`.
 *
 * @param {object} [opts] - Optional parameters
 * @param {string} [opts.defaultKey='name'] - The property key to sort by initially
 * @param {('asc'|'desc')} [opts.defaultDirection='asc'] - The initial sort direction
 * @param {import('svelte/store').Writable<{key: string, direction: string}>} [opts.store] - An existing writable store to bind to
 * @return {function} The sort comparator function with store capabilities
 */
/**
 * Creates a sort comparator for item lists with a toggleable key/direction.
 *
 * The returned function is a standard `Array.prototype.sort` comparator and also exposes
 * `toggle(key)`, `setSort(key, direction)`, `getKey()`, and `getDirection()` so callers can
 * drive the active sort state from plain reactive variables (no Svelte store required).
 *
 * Values are resolved via dotpath (e.g. `system.quantity`) or via a custom resolver function
 * supplied in `opts.resolvers` (useful for derived values such as price). Numeric values are
 * compared numerically; everything else uses a locale-aware string comparison. Direction may be
 * `'asc'` or `'desc'`.
 *
 * @param {object} [opts] - Optional parameters
 * @param {string} [opts.defaultKey='name'] - The property key to sort by initially
 * @param {('asc'|'desc')} [opts.defaultDirection='asc'] - The initial sort direction
 * @param {object} [opts.resolvers={}] - Map of key -> (data) => comparable value
 * @return {function} The sort comparator function with helper methods
 */
export function createSortQuery({ defaultKey = 'name', defaultDirection = 'asc', resolvers = {} } = {}) {
  let key = defaultKey;
  let direction = defaultDirection;

  /**
   * Resolve a value from an object via a custom resolver, dotpath, or direct key lookup.
   * @param {object} data - The data object
   * @param {string} k - The property key (may be a dotpath)
   * @return {*} The resolved value
   */
  function resolveValue(data, k) {
    if (resolvers[k]) return resolvers[k](data);
    if (k.includes('.')) {
      const steps = stepwiseResolveDotpath(data, k);
      return steps[steps.length - 1].val;
    }
    return data?.[k];
  }

  /**
   * Comparator that sorts two data objects by the active key/direction.
   * @param {object} a - First data object
   * @param {object} b - Second data object
   * @return {number} Negative, zero, or positive
   */
  function sortQuery(a, b) {
    const av = resolveValue(a, key);
    const bv = resolveValue(b, key);

    if (window.GAS?.log?.d) {
      window.GAS.log.d('createSortQuery.compare', { key, direction, av, bv, aName: a?.name ?? a?.itemName, bName: b?.name ?? b?.itemName });
    }

    let result;
    if (typeof av === 'number' && typeof bv === 'number') {
      result = av - bv;
    } else if (av == null && bv == null) {
      result = 0;
    } else if (av == null) {
      result = -1;
    } else if (bv == null) {
      result = 1;
    } else {
      result = String(av).localeCompare(String(bv), game?.i18n?.lang ?? undefined, { numeric: true, sensitivity: 'base' });
    }

    return direction === 'desc' ? -result : result;
  }

  /**
   * Toggle the sort: if the same key is clicked, flip the direction; otherwise switch key
   * and reset to ascending.
   * @param {string} newKey - The property key to sort by
   * @return {void} Nothing
   */
  sortQuery.toggle = (newKey) => {
    if (newKey === key) {
      direction = direction === 'asc' ? 'desc' : 'asc';
    } else {
      key = newKey;
      direction = 'asc';
    }
  };

  /**
   * Explicitly set the sort key/direction.
   * @param {string} newKey - The property key to sort by
   * @param {('asc'|'desc')} [newDirection='asc'] - The sort direction
   * @return {void} Nothing
   */
  sortQuery.setSort = (newKey, newDirection = 'asc') => {
    key = newKey;
    direction = newDirection === 'desc' ? 'desc' : 'asc';
  };

  /** @return {string} The active sort key */
  sortQuery.getKey = () => key;

  /** @return {string} The active sort direction ('asc' | 'desc') */
  sortQuery.getDirection = () => direction;

  return sortQuery;
}
