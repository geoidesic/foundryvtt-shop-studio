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
