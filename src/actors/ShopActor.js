import { MODULE_ID } from '~/src/helpers/constants';
import {
  LEGACY_SHOP_ACTOR_TYPE,
  SHOP_ACTOR_TYPE,
  SHOP_IDENTITY_KIND,
  SHOP_FLAG_SCOPE,
  SHOP_FLAG_KEYS,
  DEFAULT_SHOP_CONFIGURATION
} from '~/src/constants/shopConstants';
import {
  getShopConfiguration,
  getShopStock,
  setShopConfiguration,
  setShopIdentity,
  setShopStock,
} from '~/src/helpers/shopIdentity.js';

// Re-export constants for backward compatibility
export {
  LEGACY_SHOP_ACTOR_TYPE,
  SHOP_ACTOR_TYPE,
  SHOP_IDENTITY_KIND,
  SHOP_FLAG_SCOPE,
  SHOP_FLAG_KEYS,
  DEFAULT_SHOP_CONFIGURATION
};

let RegisteredShopActor = null;

export function getShopActorType() {
  const systemActorTypes = game?.system?.documentTypes?.Actor;
  const actorTypes = Array.isArray(systemActorTypes)
    ? systemActorTypes
    : Object.keys(systemActorTypes ?? CONFIG.Actor?.typeLabels ?? {});
  if (actorTypes.includes(SHOP_ACTOR_TYPE)) return SHOP_ACTOR_TYPE;
  return CONFIG.Actor?.defaultType ?? actorTypes[0] ?? SHOP_ACTOR_TYPE;
}

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
      return getShopConfiguration(this);
    }

    /**
     * Updates shop configuration data.
     * @param {Record<string, unknown>} update
     */
    async updateShopConfiguration(update) {
      return setShopConfiguration(this, update);
    }

    /**
     * Returns the persisted stock snapshot.
     * @returns {Array<Record<string, unknown>>}
     */
    get stockSnapshot() {
      return getShopStock(this);
    }

    /**
     * Persists a new stock snapshot.
     * @param {Array<Record<string, unknown>>} stock
     */
    async setStockSnapshot(stock) {
      return setShopStock(this, stock);
    }

    /**
     * Marks the actor as a shop when the underlying system does not support a custom type.
     * @returns {Promise<foundry.abstract.Document>} update result
     */
    async setShopIdentity() {
      return setShopIdentity(this);
    }
  }

  RegisteredShopActor = ShopActor;

  return ShopActor;
}
