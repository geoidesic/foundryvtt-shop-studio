import { MODULE_ID } from '~/src/helpers/constants';
import {
  DEFAULT_SHOP_CONFIGURATION,
  SHOP_FLAG_KEYS,
  SHOP_FLAG_SCOPE,
  SHOP_IDENTITY_KIND,
} from '~/src/constants/shopConstants.js';

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
