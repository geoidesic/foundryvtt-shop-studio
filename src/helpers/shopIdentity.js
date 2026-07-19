import { MODULE_ID } from '~/src/helpers/constants';
import {
  DEFAULT_SHOP_CONFIGURATION,
  SHOP_FLAG_KEYS,
  SHOP_FLAG_SCOPE,
  SHOP_IDENTITY_KIND,
} from '~/src/constants/shopConstants.js';
import {
  addDenominationFunds,
  getDefaultCurrency,
  normalizePrice,
  subtractDenominationFunds,
} from '~/src/helpers/currency.js';

export function getShopIdentity(actor) {
  return actor?.getFlag?.(MODULE_ID, SHOP_FLAG_KEYS.identity)
    ?? actor?.getFlag?.(SHOP_FLAG_SCOPE, SHOP_FLAG_KEYS.identity)
    ?? {};
}

export async function setShopIdentity(actor, identity = {}) {
  return actor?.setFlag?.(MODULE_ID, SHOP_FLAG_KEYS.identity, {
    isShop: true,
    kind: SHOP_IDENTITY_KIND,
    ...identity,
  });
}

export function isShopEditing(actor) {
  return getShopIdentity(actor).isEditing ?? false;
}

export async function setShopEditing(actor, isEditing) {
  return actor?.setFlag?.(MODULE_ID, `${SHOP_FLAG_KEYS.identity}.isEditing`, Boolean(isEditing));
}

export function isShopActor(actor) {
  const identity = getShopIdentity(actor);
  return identity.isShop === true || identity.kind === SHOP_IDENTITY_KIND;
}

export function getShopConfiguration(actor) {
  const configuration = actor?.getFlag?.(MODULE_ID, SHOP_FLAG_KEYS.configuration)
    ?? actor?.getFlag?.(SHOP_FLAG_SCOPE, SHOP_FLAG_KEYS.configuration)
    ?? {};
  return {
    ...DEFAULT_SHOP_CONFIGURATION,
    ...configuration,
    salePriceFactor: configuration.salePriceFactor ?? configuration.pricingFactor ?? DEFAULT_SHOP_CONFIGURATION.salePriceFactor,
    buyPriceFactor: configuration.buyPriceFactor ?? DEFAULT_SHOP_CONFIGURATION.buyPriceFactor,
  };
}

export async function setShopConfiguration(actor, update = {}) {
  const configuration = foundry.utils.mergeObject(getShopConfiguration(actor), update ?? {}, { inplace: false });
  return actor?.setFlag?.(MODULE_ID, SHOP_FLAG_KEYS.configuration, configuration);
}

export function getShopStock(actor) {
  const stock = actor?.getFlag?.(MODULE_ID, SHOP_FLAG_KEYS.stock);
  return Array.isArray(stock) ? stock : [];
}

export async function setShopStock(actor, stock = []) {
  return actor?.setFlag?.(MODULE_ID, SHOP_FLAG_KEYS.stock, stock ?? []);
}

export function getShopTransactions(actor) {
  const transactions = actor?.getFlag?.(MODULE_ID, SHOP_FLAG_KEYS.transactions);
  return Array.isArray(transactions) ? transactions : [];
}

export async function appendShopTransactions(actor, transactions = []) {
  if (!transactions.length) return actor;
  return actor?.setFlag?.(MODULE_ID, SHOP_FLAG_KEYS.transactions, [
    ...getShopTransactions(actor),
    ...transactions,
  ]);
}

/**
 * Read the shop's vendor funds (a system-agnostic denomination map).
 * Lazily seeds from the `defaultVendorFunds` world setting (converted to the
 * active system's default currency) the first time it is read for a shop that
 * has no funds flag yet.
 * @param {object} actor - The shop actor
 * @return {object} Denomination map, e.g. { gp: 1000 }
 */
export function getVendorFunds(actor) {
  const funds = actor?.getFlag?.(MODULE_ID, SHOP_FLAG_KEYS.vendorFunds);
  if (isPlainObjectFunds(funds)) return funds;

  const seeded = seedDefaultVendorFunds();
  return seeded;
}

function isPlainObjectFunds(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Build a denomination map from the `defaultVendorFunds` world setting, seeding
 * the full gold-equivalent into the active system's default currency.
 * @return {object} Denomination map
 */
export function seedDefaultVendorFunds() {
  const defaultFunds = Number(game?.settings?.get?.(MODULE_ID, 'defaultVendorFunds') ?? 0);
  const amount = Number.isFinite(defaultFunds) ? defaultFunds : 0;
  if (amount <= 0) return {};
  const denomination = getDefaultCurrency();
  return denomination ? { [denomination]: amount } : {};
}

export async function setVendorFunds(actor, funds = {}) {
  const normalized = Object.fromEntries(
    Object.entries(funds ?? {})
      .map(([denomination, amount]) => [denomination, Number(amount)])
      .filter(([, amount]) => Number.isFinite(amount) && amount > 0),
  );
  return actor?.setFlag?.(MODULE_ID, SHOP_FLAG_KEYS.vendorFunds, normalized);
}

/**
 * Adjust the shop's vendor funds by a price (positive credits, negative debits).
 * @param {object} actor - The shop actor
 * @param {object|number|string} price - A price in any shape accepted by normalizePrice
 * @param {object} [options]
 * @param {boolean} [options.allowNegative=false] - When false, debits that would
 *   go negative are rejected (returns success:false).
 * @return {Promise<{success: boolean, errors: string[], funds: object}>}
 */
export async function adjustVendorFunds(actor, price, { allowNegative = false } = {}) {
  const current = getVendorFunds(actor);
  const normalized = normalizePrice(price);
  const isDebit = getIsDebit(normalized);

  if (isDebit) {
    const result = subtractDenominationFunds(current, price);
    if (!result.success && !allowNegative) {
      return {
        success: false,
        errors: [`${actor?.name ?? 'Shop'} has insufficient vendor funds.`],
        funds: current,
      };
    }
    const next = allowNegative ? addDenominationFunds(current, price) : result.funds;
    await setVendorFunds(actor, next);
    return { success: true, errors: [], funds: next };
  }

  const next = addDenominationFunds(current, price);
  await setVendorFunds(actor, next);
  return { success: true, errors: [], funds: next };
}

function getIsDebit(normalized) {
  if (isDenominationMapValue(normalized.value)) {
    return Object.values(normalized.value).some((amount) => Number(amount) < 0);
  }
  return Number(normalized.value) < 0;
}

function isDenominationMapValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}
