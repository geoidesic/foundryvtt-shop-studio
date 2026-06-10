import { MODULE_ID } from '~/src/helpers/constants';

export const LEGACY_SHOP_ACTOR_TYPE = 'shop';
export const SHOP_ACTOR_TYPE = 'npc';
export const SHOP_IDENTITY_KIND = `${MODULE_ID}.shop`;
export const SHOP_FLAG_SCOPE = MODULE_ID;
export const SHOP_FLAG_KEYS = Object.freeze({
  configuration: 'configuration',
  stock: 'stock',
  transactions: 'transactions',
  identity: 'identity'
});

export const DEFAULT_SHOP_CONFIGURATION = Object.freeze({
  pricingFactor: 100,
  priceVariance: 10,
  variancePeriod: 'daily',
  atrophyPercent: 5,
  associatedActors: [],
  rollTables: []
});

let RegisteredShopActor = null;

export function registerShopActor() {
  const BaseActorClass = CONFIG.Actor.documentClass;

  if (RegisteredShopActor) {
    return RegisteredShopActor;
  }

  class ShopActor extends BaseActorClass {
    /**
     * Indicates whether the Actor is managed by Shop Studio.
     * @returns {boolean}
     */
    get isShop() {
      if (this.type === LEGACY_SHOP_ACTOR_TYPE) {
        return true;
      }

      const identity = this.getFlag(MODULE_ID, SHOP_FLAG_KEYS.identity);
      return identity?.isShop === true || identity?.kind === SHOP_IDENTITY_KIND;
    }

    /**
     * Retrieves configuration data for this shop.
     * @returns {Record<string, unknown>}
     */
    get shopConfiguration() {
      return this.system?.configuration ?? {};
    }

    /**
     * Updates shop configuration data.
     * @param {Record<string, unknown>} update
     */
    async updateShopConfiguration(update) {
      return this.update({ system: { configuration: foundry.utils.mergeObject(this.shopConfiguration, update ?? {}, { inplace: false }) } });
    }

    /**
     * Returns the persisted stock snapshot.
     * @returns {Array<Record<string, unknown>>}
     */
    get stockSnapshot() {
      return this.system?.stock ?? [];
    }

    /**
     * Persists a new stock snapshot.
     * @param {Array<Record<string, unknown>>} stock
     */
    async setStockSnapshot(stock) {
      return this.update({ system: { stock: stock ?? [] } });
    }

    /**
     * Marks the actor as a shop when the underlying system does not support a custom type.
     * @returns {Promise<foundry.abstract.Document>} update result
     */
    async setShopIdentity() {
      return this.update({ system: { identity: { isShop: true, kind: SHOP_IDENTITY_KIND } } });
    }
  }

  // Register the actor class with the system
  CONFIG.Actor.documentClass = ShopActor;
  RegisteredShopActor = ShopActor;

  return ShopActor;
}
