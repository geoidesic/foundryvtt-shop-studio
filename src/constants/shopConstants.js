export const LEGACY_SHOP_ACTOR_TYPE = 'shop';
export const SHOP_ACTOR_TYPE = 'npc';
export const SHOP_IDENTITY_KIND = 'shop-studio.shop';
export const SHOP_FLAG_SCOPE = 'shop-studio';
export const SHOP_FLAG_KEYS = Object.freeze({
  configuration: 'configuration',
  stock: 'stock',
  transactions: 'transactions',
  identity: 'identity'
});

export const DEFAULT_SHOP_CONFIGURATION = Object.freeze({
  pricingFactor: 100,
  salePriceFactor: 100,
  buyPriceFactor: 50,
  priceVariance: 10,
  variancePeriod: 'daily',
  atrophyPercent: 5,
  associatedActors: [],
  rollTables: []
});
