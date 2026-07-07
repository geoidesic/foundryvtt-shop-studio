import { MODULE_ID } from '~/src/helpers/constants';
import { shopTelemetry } from '~/src/helpers/telemetry.js';

export const SHOP_TARGETS_FLAG = 'targetedActors';

function safeFromUuid(uuid) {
  if (typeof uuid !== 'string' || !uuid.includes('.')) return null;
  try {
    return globalThis.fromUuidSync?.(uuid) ?? null;
  } catch (error) {
    shopTelemetry('shopTargets', 'fromUuidSync failed', {
      uuid,
      error: error?.message,
    });
    return null;
  }
}

function resolveActor(actorOrId) {
  if (!actorOrId) return null;
  if (typeof actorOrId !== 'string') return actorOrId;
  return game.actors.get(actorOrId) ?? safeFromUuid(actorOrId);
}

function normalizeTargetEntry(entry) {
  if (!entry?.actorId && !entry?.actorUuid) return null;
  const actor = resolveActor(entry.actorUuid) ?? resolveActor(entry.actorId);
  return {
    actorId: entry.actorId ?? actor?.id,
    actorUuid: entry.actorUuid ?? actor?.uuid,
    tokenUuid: entry.tokenUuid ?? null,
    name: entry.name ?? actor?.name ?? entry.actorId ?? entry.actorUuid,
    img: entry.img ?? actor?.img ?? 'icons/svg/mystery-man.svg',
    userId: entry.userId ?? game.user?.id,
    source: entry.source ?? 'selection',
    timestamp: Number(entry.timestamp ?? Date.now()),
  };
}

export function getShopTargetEntries(shop) {
  return (shop?.getFlag?.(MODULE_ID, SHOP_TARGETS_FLAG) ?? [])
    .map(normalizeTargetEntry)
    .filter(Boolean);
}

export function getCurrentTokenTargetEntries({ excludeActorId = null, source = 'token-target' } = {}) {
  return [...(game.user?.targets ?? [])]
    .map((token) => {
      const actor = token?.actor;
      if (!actor || actor.id === excludeActorId) return null;
      return normalizeTargetEntry({
        actorId: actor.id,
        actorUuid: actor.uuid,
        tokenUuid: token.document?.uuid,
        name: actor.name,
        img: actor.img ?? token.document?.texture?.src,
        userId: game.user?.id,
        source,
        timestamp: Date.now(),
      });
    })
    .filter(Boolean);
}

function mergeTargetEntries(currentEntries, nextEntries) {
  const byActor = new Map();
  for (const entry of [...currentEntries, ...nextEntries]) {
    const normalized = normalizeTargetEntry(entry);
    if (!normalized?.actorId) continue;
    byActor.set(normalized.actorId, normalized);
  }
  return [...byActor.values()];
}

export async function registerShopTargetEntries(shop, entries) {
  if (!shop?.setFlag || !Array.isArray(entries) || entries.length === 0) return [];
  const currentEntries = getShopTargetEntries(shop);
  const nextEntries = mergeTargetEntries(currentEntries, entries);
  await shop.setFlag(MODULE_ID, SHOP_TARGETS_FLAG, nextEntries);
  shopTelemetry('shopTargets', 'registered shop target entries', {
    shopId: shop?.id,
    shopUuid: shop?.uuid,
    entryActorIds: entries.map((entry) => entry?.actorId),
    targetActorIds: nextEntries.map((entry) => entry.actorId),
  });
  return nextEntries;
}

export async function registerShopTargetActor(shop, actorOrId, { source = 'selection' } = {}) {
  const actor = resolveActor(actorOrId);
  if (!actor || actor.id === shop?.id) return [];
  return registerShopTargetEntries(shop, [{
    actorId: actor.id,
    actorUuid: actor.uuid,
    name: actor.name,
    img: actor.img,
    userId: game.user?.id,
    source,
    timestamp: Date.now(),
  }]);
}

export async function registerCurrentTokenTargets(shop, options = {}) {
  const entries = getCurrentTokenTargetEntries({
    excludeActorId: shop?.id,
    source: options.source ?? 'token-target',
  });
  return registerShopTargetEntries(shop, entries);
}

export function resolveShopTargetActor(shop, targetActorId) {
  const actor = resolveActor(targetActorId);
  if (actor) return actor;

  const targetEntry = getShopTargetEntries(shop).find((entry) => entry.actorId === targetActorId);
  return resolveActor(targetEntry?.actorUuid);
}
