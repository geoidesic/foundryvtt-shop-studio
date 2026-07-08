import { MODULE_ID } from '~/src/helpers/constants.ts';

export const LEGACY_SHOP_ACTOR_TYPE = 'shop';
export const SHOP_ACTOR_TYPE = 'npc';
export const SHOP_IDENTITY_KIND = MODULE_ID+'.shop';
export const SHOP_FLAG_SCOPE = MODULE_ID;
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
  rollTables: [],
  rollTableRolls: []
});
