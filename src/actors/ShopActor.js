import { MODULE_ID } from '~/src/helpers/constants';
import { ShopActorModel } from '~/src/models/actors/ShopActorModel';
import {
  LEGACY_SHOP_ACTOR_TYPE,
  SHOP_ACTOR_TYPE,
  SHOP_IDENTITY_KIND,
  SHOP_FLAG_SCOPE,
  SHOP_FLAG_KEYS,
  DEFAULT_SHOP_CONFIGURATION
} from '~/src/constants/shopConstants';

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
  // Extend the existing dnd5e NPC data model instead of replacing it
  const ExistingNPCModel = CONFIG.Actor.dataModels[SHOP_ACTOR_TYPE];
  if (ExistingNPCModel && ExistingNPCModel !== ShopActorModel) {
    // Create a merged model that extends the dnd5e NPC model with shop fields
    class MergedShopActorModel extends ExistingNPCModel {
      static defineSchema() {
        return {
          ...super.defineSchema(),
          ...ShopActorModel.defineSchema(),
        };
      }

      get shopConfiguration() {
        return this.configuration ?? {};
      }

      async updateShopConfiguration(update) {
        const merged = foundry.utils.mergeObject(this.shopConfiguration, update ?? {}, { inplace: false });
        return this.parent?.update({ system: { configuration: merged } });
      }

      get stockSnapshot() {
        return this.stock ?? [];
      }

      async setStockSnapshot(stock) {
        return this.parent?.update({ system: { stock: stock ?? [] } });
      }
    }
    CONFIG.Actor.dataModels[SHOP_ACTOR_TYPE] = MergedShopActorModel;
  } else {
    CONFIG.Actor.dataModels[SHOP_ACTOR_TYPE] = ShopActorModel;
  }
  RegisteredShopActor = ShopActor;

  return ShopActor;
}
