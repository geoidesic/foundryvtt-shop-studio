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
