import { derived, writable } from 'svelte/store';
import { SHOP_ACTOR_TYPE, SHOP_FLAG_SCOPE, SHOP_FLAG_KEYS } from '~/src/constants/shopConstants';

export const catalogItems = writable([]);
export const shopCart = writable(new Map());
export const priceMultiplier = writable(1);

export const cartTotal = derived(shopCart, ($shopCart) => {
  let runningTotal = 0;
  for (const [, entry] of $shopCart.entries()) {
    runningTotal += entry?.total ?? 0;
  }
  return runningTotal;
});

export function initialiseShopState(actor) {
  const isShopActor = actor?.isShop;

  if (!actor || !isShopActor) {
    resetShopState();
    return;
  }

  catalogItems.set([]);
  shopCart.set(new Map());
  priceMultiplier.set(1);
}

export function resetShopState() {
  catalogItems.set([]);
  shopCart.set(new Map());
  priceMultiplier.set(1);
}

// Function to reset all shop stores
export function resetStores() {
  resetShopState();
}
