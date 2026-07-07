import { writable } from 'svelte/store';
import { shopTelemetry } from '~/src/helpers/telemetry.js';

export const shopSocketState = writable(new Map());

function getShopUuids(payload) {
  const uuids = new Set();

  for (const shopUuid of payload?.shopUuids ?? []) {
    if (typeof shopUuid === 'string' && shopUuid) uuids.add(shopUuid);
  }

  const shopUuid = payload?.shopUuid ?? payload?.uuid;
  if (typeof shopUuid === 'string' && shopUuid) uuids.add(shopUuid);

  const resolvedShopUuid = payload?.resolvedShopUuid;
  if (typeof resolvedShopUuid === 'string' && resolvedShopUuid) uuids.add(resolvedShopUuid);

  const shopId = payload?.shopId ?? payload?.id;
  if (typeof shopId === 'string' && shopId) {
    uuids.add(shopId.startsWith('Actor.') ? shopId : `Actor.${shopId}`);
  }

  return [...uuids];
}

export function recordShopSocketResult(payload) {
  const shopUuids = getShopUuids(payload);
  if (shopUuids.length === 0) {
    shopTelemetry('basketState', 'record skipped: no shop uuid', {
      kind: payload?.kind,
      shopId: payload?.shopId,
      targetActorId: payload?.targetActorId,
    });
    return;
  }

  shopSocketState.update((state) => {
    const nextState = new Map(state);

    for (const shopUuid of shopUuids) {
      const current = nextState.get(shopUuid) ?? {
        basketsByActorId: new Map(),
        stockByItemId: new Map(),
        revision: 0,
      };

      const nextShopState = {
        basketsByActorId: new Map(current.basketsByActorId),
        stockByItemId: new Map(current.stockByItemId),
        revision: current.revision + 1,
      };

      if (payload.targetActorId && Array.isArray(payload.basket)) {
        nextShopState.basketsByActorId.set(
          payload.targetActorId,
          payload.basket.map((entry) => ({ ...entry })),
        );
      }

      for (const update of payload.stockUpdates ?? []) {
        if (update?.itemId) {
          nextShopState.stockByItemId.set(update.itemId, Number(update.quantity ?? 0));
        }
      }

      nextState.set(shopUuid, nextShopState);
    }

    shopTelemetry('basketState', 'recorded socket result', {
      kind: payload.kind,
      shopUuids,
      targetActorId: payload.targetActorId,
      basketLength: payload.basket?.length,
      stockUpdates: payload.stockUpdates,
      revisions: shopUuids.map((shopUuid) => ({
        shopUuid,
        revision: nextState.get(shopUuid)?.revision,
        basketActorIds: [...(nextState.get(shopUuid)?.basketsByActorId?.keys?.() ?? [])],
      })),
    });
    return nextState;
  });
}
