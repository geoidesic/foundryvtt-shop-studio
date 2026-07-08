import { writable } from 'svelte/store';

export const shopConfig = writable({
  salePriceFactor: 100,
  buyPriceFactor: 50,
  priceVariance: 10,
  variancePeriod: 'daily',
  atrophyPercent: 5,
  associatedActors: [],
  rollTables: [],
  rollTableRolls: []
});
