function getConfigNamespaceCandidates() {
  const systemId = game?.system?.id ?? '';
  const compactId = systemId.replace(/[^A-Za-z0-9]/g, '');
  return [
    systemId,
    systemId.toUpperCase(),
    compactId,
    compactId.toUpperCase(),
  ].filter(Boolean);
}

function localizeCurrencyText(value, fallback = '') {
  if (!value) return fallback;
  if (typeof value !== 'string') return String(value);
  return game?.i18n?.has?.(value) ? game.i18n.localize(value) : value;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

const COMMON_COIN_VALUES = Object.freeze({
  pp: 10,
  gp: 1,
  ep: 0.5,
  sp: 0.1,
  cp: 0.01,
  gc: 240,
  ss: 12,
  bp: 1,
});

const COPPER_VALUES = Object.freeze({
  pp: 1000,
  gp: 100,
  ep: 50,
  sp: 10,
  cp: 1,
});

function isDenominationMap(value) {
  return isPlainObject(value)
    && Object.values(value).some((amount) => Number(amount) > 0)
    && Object.values(value).every((amount) => Number.isFinite(Number(amount)));
}

function cleanDenominationMap(value, factor = 1) {
  return Object.fromEntries(Object.entries(value ?? {})
    .map(([denomination, amount]) => [denomination, Number(amount) * factor])
    .filter(([, amount]) => Number.isFinite(amount) && amount > 0));
}

function getCurrencyNamespaceConfig() {
  for (const namespace of getConfigNamespaceCandidates()) {
    const config = CONFIG?.[namespace];
    if (config?.currencies) return config;
  }

  return Object.values(CONFIG ?? {}).find((config) => (
    config
    && typeof config === 'object'
    && config.currencies
    && typeof config.currencies === 'object'
  )) ?? null;
}

export function getSystemCurrencies() {
  return getCurrencyNamespaceConfig()?.currencies ?? {};
}

export function getDefaultCurrency() {
  const config = getCurrencyNamespaceConfig();
  if (config?.defaultCurrency && config.defaultCurrency in (config.currencies ?? {})) {
    return config.defaultCurrency;
  }

  return Object.keys(config?.currencies ?? {})[0] ?? '';
}

export function getCurrencyLabel(denomination, { abbreviated = true } = {}) {
  const currency = getSystemCurrencies()[denomination];
  if (!currency) {
    const pf2eLabel = `PF2E.CurrencyAbbreviations.${denomination}`;
    return game?.i18n?.has?.(pf2eLabel) ? game.i18n.localize(pf2eLabel) : (denomination || '');
  }
  if (typeof currency === 'string') return localizeCurrencyText(currency, denomination);

  const text = abbreviated
    ? currency.abbreviation ?? currency.label ?? denomination
    : currency.label ?? currency.abbreviation ?? denomination;
  return localizeCurrencyText(text, denomination);
}

export function getCurrencyConversion(denomination) {
  const conversion = Number(getSystemCurrencies()[denomination]?.conversion);
  return Number.isFinite(conversion) && conversion > 0 ? conversion : null;
}

export function normalizePrice(price) {
  if (isDenominationMap(price)) {
    return {
      value: cleanDenominationMap(price),
      denomination: '',
      per: 1,
      source: price,
    };
  }

  if (typeof price === 'number') {
    return {
      value: Number.isFinite(price) ? price : 0,
      denomination: getDefaultCurrency(),
      source: price,
    };
  }

  if (typeof price === 'string') {
    const value = Number(price);
    return {
      value: Number.isFinite(value) ? value : 0,
      denomination: getDefaultCurrency(),
      source: price,
    };
  }

  if (isPlainObject(price)) {
    if (isDenominationMap(price.value)) {
      return {
        ...price,
        value: cleanDenominationMap(price.value),
        denomination: '',
        per: Math.max(1, Number(price.per ?? 1)),
        source: price,
      };
    }

    const value = Number(price.value ?? price.amount ?? 0);
    const denomination = price.denomination ?? price.currency ?? getDefaultCurrency();
    return {
      ...price,
      value: Number.isFinite(value) ? value : 0,
      denomination,
      source: price,
    };
  }

  return {
    value: 0,
    denomination: getDefaultCurrency(),
    source: price,
  };
}

export function getPriceValue(price) {
  return normalizePrice(price).value;
}

export function getPriceDenomination(price) {
  return normalizePrice(price).denomination;
}

export function getComparablePriceValue(price) {
  const normalized = normalizePrice(price);
  if (isDenominationMap(normalized.value)) {
    return Object.entries(normalized.value).reduce((sum, [denomination, amount]) => {
      return sum + (Number(amount) * (COMMON_COIN_VALUES[denomination] ?? 1));
    }, 0) / Math.max(1, Number(normalized.per ?? 1));
  }

  const conversion = getCurrencyConversion(normalized.denomination);
  if (!conversion) return normalized.value;
  return normalized.value / conversion;
}

export function makeBasketPrice(price) {
  const normalized = normalizePrice(price);
  if (isDenominationMap(normalized.value)) {
    return {
      value: normalized.value,
      per: normalized.per,
    };
  }

  return {
    value: normalized.value,
    denomination: normalized.denomination,
  };
}

export function applyPriceFactor(price, factorPercent = 100) {
  const normalized = normalizePrice(price);
  const factor = Number(factorPercent) / 100;
  const multiplier = Number.isFinite(factor) ? factor : 1;

  if (isDenominationMap(normalized.value)) {
    return {
      ...normalized,
      value: cleanDenominationMap(normalized.value, multiplier),
    };
  }

  return {
    ...normalized,
    value: normalized.value * multiplier,
  };
}

export function formatPrice(price) {
  const normalized = normalizePrice(price);
  if (isDenominationMap(normalized.value)) {
    const formatted = Object.entries(normalized.value)
      .reverse()
      .map(([denomination, amount]) => `${amount} ${getCurrencyLabel(denomination)}`)
      .join(', ');
    const per = Number(normalized.per ?? 1);
    return per > 1 ? `${formatted} / ${per}` : formatted;
  }

  if (!normalized.value) return '—';

  const label = getCurrencyLabel(normalized.denomination);
  return label ? `${normalized.value} ${label}` : String(normalized.value);
}

export function multiplyPrice(price, quantity = 1) {
  const normalized = normalizePrice(price);
  const factor = Math.max(0, Number(quantity ?? 0)) / Math.max(1, Number(normalized.per ?? 1));
  if (isDenominationMap(normalized.value)) {
    return {
      value: cleanDenominationMap(normalized.value, factor),
      per: 1,
    };
  }

  return {
    value: normalized.value * factor,
    denomination: normalized.denomination,
  };
}

export function sumPrices(prices) {
  const entries = (prices ?? []).map(({ price, quantity = 1 }) => {
    const normalized = normalizePrice(price);
    return {
      ...normalized,
      quantity: Math.max(0, Number(quantity ?? 0)),
      conversion: getCurrencyConversion(normalized.denomination),
    };
  }).filter((entry) => entry.value && entry.quantity);

  if (!entries.length) return { value: 0, denomination: getDefaultCurrency() };

  if (entries.every((entry) => isDenominationMap(entry.value))) {
    const value = entries.reduce((sum, entry) => {
      const multiplied = multiplyPrice(entry, entry.quantity).value;
      for (const [denomination, amount] of Object.entries(multiplied)) {
        sum[denomination] = (sum[denomination] ?? 0) + amount;
      }
      return sum;
    }, {});
    return { value, per: 1 };
  }

  const defaultCurrency = getDefaultCurrency();
  const defaultConversion = getCurrencyConversion(defaultCurrency);
  if (defaultCurrency && defaultConversion && entries.every((entry) => entry.conversion)) {
    const value = entries.reduce((sum, entry) => {
      return sum + ((entry.value * entry.quantity) / entry.conversion) * defaultConversion;
    }, 0);
    return { value, denomination: defaultCurrency };
  }

  const [firstEntry] = entries;
  if (entries.every((entry) => entry.denomination === firstEntry.denomination)) {
    return {
      value: entries.reduce((sum, entry) => sum + (entry.value * entry.quantity), 0),
      denomination: firstEntry.denomination,
    };
  }

  return entries.map((entry) => multiplyPrice(entry, entry.quantity));
}

export function formatTotalPrice(prices) {
  const total = sumPrices(prices);
  if (Array.isArray(total)) return total.map((price) => formatPrice(price)).join(', ');
  return formatPrice(total);
}

function getCurrencyEntriesWithConversions() {
  return Object.entries(getSystemCurrencies())
    .map(([denomination, config]) => [denomination, Number(config?.conversion)])
    .filter(([, conversion]) => Number.isFinite(conversion) && conversion > 0);
}

function roundCurrency(value) {
  const rounded = Math.round(Number(value) * 1000000) / 1000000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function getActorCurrency(actor) {
  const currency = actor?.system?.currency;
  return isPlainObject(currency) ? foundry.utils.deepClone(currency) : null;
}

function getCurrencyValue(currency, denomination) {
  return Number(currency?.[denomination] ?? 0);
}

function totalCurrencyInDenomination(currency, denomination) {
  const baseConversion = getCurrencyConversion(denomination);
  if (!baseConversion) return getCurrencyValue(currency, denomination);

  return Object.entries(currency ?? {}).reduce((sum, [heldDenomination, amount]) => {
    const conversion = getCurrencyConversion(heldDenomination);
    if (!conversion) return sum;
    return sum + (Number(amount) * (baseConversion / conversion));
  }, 0);
}

function deductCurrencyPart(currency, amount, denomination) {
  const requestedAmount = roundCurrency(Math.max(0, Number(amount ?? 0)));
  if (requestedAmount <= 0) return { success: true, currency, remainder: 0 };

  const baseConversion = getCurrencyConversion(denomination);
  if (!baseConversion) {
    const available = getCurrencyValue(currency, denomination);
    if (available < requestedAmount) {
      return { success: false, currency, remainder: requestedAmount - available };
    }
    currency[denomination] = roundCurrency(available - requestedAmount);
    return { success: true, currency, remainder: 0 };
  }

  const currencies = getCurrencyEntriesWithConversions()
    .filter(([heldDenomination]) => heldDenomination !== denomination)
    .sort(([, left], [, right]) => right - left);
  currencies.unshift([denomination, baseConversion]);

  let passes = currencies.length;
  while (passes > 0) {
    const nextCurrency = foundry.utils.deepClone(currency);
    let remainder = requestedAmount;

    for (const [heldDenomination, conversion] of currencies) {
      nextCurrency[heldDenomination] ??= 0;
      const multiplier = conversion / baseConversion;
      const heldAmount = getCurrencyValue(nextCurrency, heldDenomination);
      const deduct = Math.min(heldAmount, Math.floor((remainder * multiplier) + 0.000001));

      remainder = roundCurrency(remainder - (deduct / multiplier));
      nextCurrency[heldDenomination] = roundCurrency(heldAmount - deduct);

      if (remainder > 0.000001 && conversion < baseConversion && nextCurrency[heldDenomination] > 0) {
        const rate = Math.floor(baseConversion / conversion);
        const breaks = Math.min(nextCurrency[heldDenomination], Math.ceil(remainder / rate));
        nextCurrency[heldDenomination] = roundCurrency(nextCurrency[heldDenomination] - breaks);
        nextCurrency[denomination] = roundCurrency(getCurrencyValue(nextCurrency, denomination) + (breaks * rate));

        const change = Math.min(getCurrencyValue(nextCurrency, denomination), remainder);
        remainder = roundCurrency(remainder - change);
        nextCurrency[denomination] = roundCurrency(getCurrencyValue(nextCurrency, denomination) - change);
      }

      if (Math.abs(remainder) <= 0.000001) {
        return { success: true, currency: nextCurrency, remainder: 0 };
      }
    }

    currencies.push(currencies.shift());
    passes -= 1;
  }

  return { success: false, currency, remainder: requestedAmount };
}

function priceParts(price) {
  if (Array.isArray(price)) {
    return price.flatMap((entry) => priceParts(entry));
  }

  const normalized = normalizePrice(price);
  if (isDenominationMap(normalized.value)) {
    return Object.entries(normalized.value)
      .map(([denomination, value]) => ({ denomination, value: Number(value) / Math.max(1, Number(normalized.per ?? 1)) }))
      .filter((entry) => entry.denomination && Number(entry.value) > 0);
  }

  return [{
    denomination: normalized.denomination,
    value: Number(normalized.value ?? 0),
  }].filter((entry) => entry.denomination && Number(entry.value) > 0);
}

function getCoinMap(price) {
  return priceParts(price).reduce((coins, { denomination, value }) => {
    coins[denomination] = roundCurrency((coins[denomination] ?? 0) + Number(value));
    return coins;
  }, {});
}

function getCopperValue(price) {
  return Object.entries(getCoinMap(price)).reduce((sum, [denomination, value]) => {
    return sum + (Number(value) * (COPPER_VALUES[denomination] ?? 0));
  }, 0);
}

function getActorInventoryCoinPaymentUpdate(actor, price) {
  const coins = getCoinMap(price);
  const costCopperValue = getCopperValue(price);
  const availableCopperValue = Number(actor?.inventory?.coins?.copperValue ?? 0);
  if (!costCopperValue) {
    return { success: true, errors: [], total: price, available: actor?.inventory?.coins ?? null, update: null, coins };
  }

  if (availableCopperValue < costCopperValue) {
    return {
      success: false,
      errors: [`${actor?.name ?? 'Actor'} cannot afford ${formatPrice(price)}. Available: ${actor?.inventory?.coins?.toString?.({ decimal: true }) ?? `${availableCopperValue} cp`}.`],
      total: price,
      available: actor?.inventory?.coins ?? null,
      update: null,
      coins,
    };
  }

  return {
    success: true,
    errors: [],
    total: price,
    available: actor?.inventory?.coins ?? null,
    update: null,
    coins,
  };
}

export function getActorCurrencyPaymentUpdate(actor, price) {
  if (actor?.inventory?.removeCoins && Number.isFinite(Number(actor?.inventory?.coins?.copperValue))) {
    return getActorInventoryCoinPaymentUpdate(actor, price);
  }

  const currency = getActorCurrency(actor);
  if (!currency) {
    return {
      success: false,
      errors: [`${actor?.name ?? 'Actor'} has no supported currency purse.`],
      total: price,
      available: null,
      update: null,
    };
  }

  let nextCurrency = currency;
  const errors = [];
  for (const part of priceParts(price)) {
    const settlement = deductCurrencyPart(nextCurrency, part.value, part.denomination);
    if (!settlement.success) {
      const available = totalCurrencyInDenomination(nextCurrency, part.denomination);
      errors.push(`${actor?.name ?? 'Actor'} cannot afford ${formatPrice(part)}. Available: ${formatPrice({
        value: roundCurrency(available),
        denomination: part.denomination,
      })}.`);
      continue;
    }
    nextCurrency = settlement.currency;
  }

  return {
    success: errors.length === 0,
    errors,
    total: price,
    available: currency,
    update: { 'system.currency': nextCurrency },
  };
}

export async function deductActorCurrency(actor, price) {
  const payment = getActorCurrencyPaymentUpdate(actor, price);
  if (!payment.success) return payment;

  if (actor?.inventory?.removeCoins && payment.coins) {
    if (Object.keys(payment.coins).length === 0) return payment;
    const success = await actor.inventory.removeCoins(payment.coins, { byValue: true });
    return success ? payment : {
      ...payment,
      success: false,
      errors: [`${actor?.name ?? 'Actor'} cannot afford ${formatPrice(price)}.`],
    };
  }

  await actor.update(payment.update);
  return payment;
}
