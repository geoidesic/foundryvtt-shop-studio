const TELEMETRY_PREFIX = '[Shop Studio]';

export function shopTelemetry(scope, event, details = {}) {
  const payload = {
    scope,
    event,
    userId: globalThis.game?.user?.id,
    isGM: globalThis.game?.user?.isGM,
    ...details,
  };

  const logger = globalThis.window?.GAS?.log;
  if (logger?.p) {
    logger.p(`${TELEMETRY_PREFIX} ${scope} | ${event}`, payload);
    return;
  }

  console.debug(`${TELEMETRY_PREFIX} ${scope} | ${event}`, payload);
}

export function itemQuantitySnapshot(items) {
  const source = typeof items?.values === 'function'
    ? items.values()
    : items;

  return Array.from(source ?? []).map((entry) => {
    const item = Array.isArray(entry) ? entry[1] : entry;
    return {
      id: item?.id,
      name: item?.name,
      quantity: Number(item?.system?.quantity ?? 0),
    };
  });
}
