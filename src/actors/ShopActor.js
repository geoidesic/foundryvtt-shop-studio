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
import ShopActor from '~/src/extensions/actor.js';

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
  if (RegisteredShopActor) {
    return RegisteredShopActor;
  }

  // Register ShopActor (from extensions/actor.js) as the document class so that
  // options.document on sheets is an instance of our custom ShopActor (with
  // shop-specific methods) instead of the system base Actor (e.g., Actor5e).
  CONFIG.Actor.documentClass = ShopActor;

  // Register the data model for the NPC type (shop actors use NPC type)
  CONFIG.Actor.dataModels[SHOP_ACTOR_TYPE] = ShopActorModel;
  RegisteredShopActor = ShopActor;

  return ShopActor;
}
