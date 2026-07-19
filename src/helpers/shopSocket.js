import { MODULE_ID } from '~/src/helpers/constants';
import { TJSDocument } from '#runtime/svelte/store/fvtt/document';
import { recordShopSocketResult } from '~/src/stores/basketState.js';
import { itemQuantitySnapshot, shopTelemetry } from '~/src/helpers/telemetry.js';
import { resolveShopTargetActor } from '~/src/helpers/shopTargets.js';
import {
  adjustVendorFunds,
  appendShopTransactions,
  getVendorFunds,
} from '~/src/helpers/shopIdentity.js';
import {
  addActorCurrency,
  deductActorCurrency,
  formatPrice,
  getComparablePriceValue,
  makeBasketPrice,
  multiplyPrice,
  normalizePrice,
  subtractDenominationFunds,
  sumPrices,
} from '~/src/helpers/currency.js';

const SOCKET_NAME = `module.${MODULE_ID}`;
const SOCKET_HANDLER_KEY = `__${MODULE_ID}_socketHandler`;
const PENDING_BASKET_KEY = `__${MODULE_ID}_pendingBasketRequests`;
const PENDING_PURCHASE_KEY = `__${MODULE_ID}_pendingPurchaseRequests`;
const PENDING_SELL_KEY = `__${MODULE_ID}_pendingSellRequests`;
const SHOP_DOCUMENT_STORES_KEY = `__${MODULE_ID}_shopDocumentStores`;
const SHOP_DOCUMENT_HOOKS_KEY = `__${MODULE_ID}_shopDocumentHooksRegistered`;

function getPendingRequests(key) {
  if (!window[key]) {
    window[key] = new Map();
  }
  return window[key];
}

function getShopDocumentStores() {
  if (!window[SHOP_DOCUMENT_STORES_KEY]) {
    window[SHOP_DOCUMENT_STORES_KEY] = new Map();
  }
  return window[SHOP_DOCUMENT_STORES_KEY];
}

function getShopUuid(shop) {
  if (typeof shop === 'string') {
    return shop.includes('.') ? shop : `Actor.${shop}`;
  }

  const shopUuid = shop?.shopUuid ?? shop?.uuid;
  if (typeof shopUuid === 'string') return shopUuid;

  const shopId = shop?.shopId ?? shop?.id;
  return typeof shopId === 'string' ? `Actor.${shopId}` : null;
}

function getShopUuidAliases(shop) {
  const uuids = new Set();
  const shopUuid = getShopUuid(shop);
  if (shopUuid) uuids.add(shopUuid);

  if (typeof shop === 'object' && shop) {
    for (const alias of shop.shopUuids ?? []) {
      if (typeof alias === 'string' && alias) uuids.add(alias);
    }

    const resolvedShopUuid = shop.resolvedShopUuid;
    if (typeof resolvedShopUuid === 'string' && resolvedShopUuid) {
      uuids.add(resolvedShopUuid);
    }

    const shopId = shop.shopId ?? shop.id;
    if (typeof shopId === 'string' && shopId) {
      uuids.add(shopId.startsWith('Actor.') ? shopId : `Actor.${shopId}`);
    }
  }

  const targetDocument = resolveShopDocument(shop);
  const targetShopId = targetDocument?.id
    ?? (typeof shop === 'object' ? (shop?.shopId ?? shop?.id) : null);

  if (targetShopId) {
    for (const registeredShopUuid of getShopDocumentStores().keys()) {
      const registeredDocument = resolveShopDocument(registeredShopUuid);
      if (registeredDocument?.id === targetShopId) {
        uuids.add(registeredShopUuid);
      }
    }
  }

  return [...uuids];
}

function resolveShopDocument(shop) {
  const shopUuid = getShopUuid(shop);
  const document = shopUuid ? globalThis.fromUuidSync?.(shopUuid) : void 0;
  if (document) return document;

  if (typeof shop === 'object' && shop) {
    const shopId = shop.shopId ?? shop.id;
    if (typeof shopId === 'string' && shopId) {
      const actorId = shopId.startsWith('Actor.') ? shopId.slice('Actor.'.length) : shopId;
      const actor = game.actors.get(actorId);
      if (actor) return actor;
    }
  }

  const shopId = typeof shop === 'string'
    ? (shop.includes('.') ? shop.split('.').pop() : shop)
    : (shop?.shopId ?? shop?.id);
  return typeof shopId === 'string' ? game.actors.get(shopId) : void 0;
}

function refreshShopDocumentStore(store, shop, options = {}) {
  const document = resolveShopDocument(shop);
  shopTelemetry('shopSocket', 'refresh store start', {
    shop: getShopUuid(shop),
    documentId: document?.id,
    documentName: document?.name,
    options,
  });
  store.set(document, { ...options, action: 'shop-socket-refresh' });
  shopTelemetry('shopSocket', 'refresh store commit', {
    shop: getShopUuid(shop),
    documentId: document?.id,
    documentName: document?.name,
    options,
  });
  return document;
}

export function getShopDocumentStore(shop) {
  const shopUuid = getShopUuid(shop);
  if (!shopUuid) {
    return new TJSDocument(void 0);
  }

  const storesByShop = getShopDocumentStores();

  if (!storesByShop.has(shopUuid)) {
    storesByShop.set(shopUuid, new Set());
  }

  const stores = storesByShop.get(shopUuid);
  const existingStore = [...stores].find((store) => store.__shopSocketOwned);
  if (existingStore) return existingStore;

  const store = new TJSDocument(resolveShopDocument(shop));
  store.__shopSocketOwned = true;
  stores.add(store);
  return store;
}

export function registerShopDocumentStore(shop, store) {
  const shopUuid = getShopUuid(shop);
  if (!shopUuid || !store?.set || !store?.subscribe) return () => {};

  const storesByShop = getShopDocumentStores();
  if (!storesByShop.has(shopUuid)) {
    storesByShop.set(shopUuid, new Set());
  }

  const stores = storesByShop.get(shopUuid);
  stores.add(store);
  shopTelemetry('shopSocket', 'registered document store', {
    shopUuid,
    storeCount: stores.size,
  });

  return () => {
    stores.delete(store);
    shopTelemetry('shopSocket', 'unregistered document store', {
      shopUuid,
      storeCount: stores.size,
    });
    if (stores.size === 0) {
      storesByShop.delete(shopUuid);
    }
  };
}

export function refreshShopDocumentStores(shop, options = {}) {
  const shopUuids = getShopUuidAliases(shop);
  if (shopUuids.length === 0) return void 0;

  let document;
  for (const shopUuid of shopUuids) {
    const stores = getShopDocumentStores().get(shopUuid);
    if (!stores?.size) {
      shopTelemetry('shopSocket', 'refresh skipped: no registered stores', {
        shopUuid,
        shopUuids,
        options,
      });
      document = document ?? resolveShopDocument(shopUuid);
      continue;
    }

    shopTelemetry('shopSocket', 'refresh registered stores', {
      shopUuid,
      shopUuids,
      storeCount: stores.size,
      options,
    });

    for (const store of stores) {
      document = refreshShopDocumentStore(store, shopUuid, options);
    }
  }

  return document;
}

function sanitizeBasket(entries) {
  return (entries ?? [])
    .filter((entry) => entry?.itemId)
    .map((entry) => {
      const price = makeBasketPrice(entry.price);
      return {
        itemId: entry.itemId,
        itemName: entry.itemName,
        img: entry.img,
        price,
        priceValue: getComparablePriceValue(price),
        quantity: Math.max(0, Number(entry.quantity ?? 0)),
        direction: entry.direction === 'sell' ? 'sell' : 'buy',
        sourceActorId: entry.sourceActorId ?? null,
      };
    })
    .filter((entry) => entry.quantity > 0);
}

function indexBasket(entries) {
  return new Map((entries ?? []).map((entry) => [entry.itemId, entry]));
}

/** Negate a price (denomination map or scalar) for use as a vendor-funds debit. */
function negatePrice(price) {
  const normalized = normalizePrice(price);
  const value = normalized.value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const negated = {};
    for (const [denomination, amount] of Object.entries(value)) {
      negated[denomination] = -Number(amount);
    }
    return { value: negated, per: 1 };
  }
  return { value: -Number(value), denomination: normalized.denomination };
}

async function applyBasket(shop, targetActorId, nextBasket) {
  const currentBasket = sanitizeBasket(shop.getFlag(MODULE_ID, `basket.${targetActorId}`) ?? []);
  const desiredBasket = sanitizeBasket(nextBasket);
  const currentByItem = indexBasket(currentBasket);
  const desiredByItem = indexBasket(desiredBasket);
  const itemIds = new Set([...currentByItem.keys(), ...desiredByItem.keys()]);
  const stockUpdates = [];

  shopTelemetry('shopSocket', 'applyBasket start', {
    shopId: shop?.id,
    shopUuid: shop?.uuid,
    targetActorId,
    currentBasket,
    desiredBasket,
    stockBefore: itemQuantitySnapshot(shop?.items),
  });

  for (const itemId of itemIds) {
    const prevQty = Number(currentByItem.get(itemId)?.quantity ?? 0);
    const nextQty = Number(desiredByItem.get(itemId)?.quantity ?? 0);
    const delta = nextQty - prevQty;
    if (delta <= 0) continue;

    const desiredEntry = desiredByItem.get(itemId);
    const isSell = desiredEntry?.direction === 'sell';

    if (isSell) {
      const sourceActor = resolveShopTargetActor(shop, desiredEntry.sourceActorId ?? targetActorId);
      const sourceItem = sourceActor?.items?.get(itemId);
      if (!sourceItem) {
        shopTelemetry('shopSocket', 'applyBasket sell item missing', {
          shopId: shop?.id,
          targetActorId,
          itemId,
          sourceActorId: desiredEntry.sourceActorId,
        });
        return { success: false, errors: [`Item ${desiredEntry.itemName ?? itemId} not found on the selling actor`], basket: currentBasket };
      }
      const available = Number(sourceItem.system?.quantity ?? 0);
      if (available < delta) {
        shopTelemetry('shopSocket', 'applyBasket insufficient sell quantity', {
          shopId: shop?.id,
          targetActorId,
          itemId,
          itemName: sourceItem.name,
          available,
          delta,
        });
        return { success: false, errors: [`Insufficient quantity of ${sourceItem.name} to sell`], basket: currentBasket };
      }
      continue;
    }

    const shopItem = shop.items.get(itemId);
    if (!shopItem) {
      shopTelemetry('shopSocket', 'applyBasket item missing', {
        shopId: shop?.id,
        targetActorId,
        itemId,
        desiredBasket,
      });
      return { success: false, errors: [`Item ${desiredByItem.get(itemId)?.itemName ?? itemId} not found in shop`], basket: currentBasket };
    }

    const available = Number(shopItem.system?.quantity ?? 0);
    if (available < delta) {
      shopTelemetry('shopSocket', 'applyBasket insufficient stock', {
        shopId: shop?.id,
        targetActorId,
        itemId,
        itemName: shopItem.name,
        available,
        delta,
      });
      return { success: false, errors: [`Insufficient stock for ${shopItem.name}`], basket: currentBasket };
    }
  }

  const itemUpdates = [];
  for (const itemId of itemIds) {
    const prevQty = Number(currentByItem.get(itemId)?.quantity ?? 0);
    const nextQty = Number(desiredByItem.get(itemId)?.quantity ?? 0);
    const delta = nextQty - prevQty;
    if (delta === 0) continue;

    const desiredEntry = desiredByItem.get(itemId);
    const isSell = desiredEntry?.direction === 'sell';

    if (isSell) {
      const sourceActor = resolveShopTargetActor(shop, desiredEntry.sourceActorId ?? targetActorId);
      const sourceItem = sourceActor?.items?.get(itemId);
      if (!sourceItem) continue;

      const available = Number(sourceItem.system?.quantity ?? 0);
      const quantity = available - delta;
      shopTelemetry('shopSocket', 'applyBasket reserve sell quantity', {
        shopId: shop?.id,
        targetActorId,
        itemId,
        itemName: sourceItem.name,
        previousQuantity: available,
        delta,
        nextQuantity: quantity,
      });
      itemUpdates.push({ _id: itemId, 'system.quantity': quantity, __sourceActorId: sourceActor.id });
      continue;
    }

    const shopItem = shop.items.get(itemId);
    if (!shopItem) continue;

    const available = Number(shopItem.system?.quantity ?? 0);
    const quantity = available - delta;
    shopTelemetry('shopSocket', 'applyBasket update item quantity', {
      shopId: shop?.id,
      targetActorId,
      itemId,
      itemName: shopItem.name,
      previousQuantity: available,
      delta,
      nextQuantity: quantity,
    });
    itemUpdates.push({ _id: itemId, 'system.quantity': quantity });
    stockUpdates.push({ itemId, quantity });
  }

  if (itemUpdates.length > 0) {
    const sellUpdates = itemUpdates.filter((update) => update.__sourceActorId);
    const buyUpdates = itemUpdates.filter((update) => !update.__sourceActorId);

    if (buyUpdates.length > 0) {
      shopTelemetry('shopSocket', 'applyBasket updateEmbeddedDocuments start', {
        shopId: shop?.id,
        shopUuid: shop?.uuid,
        targetActorId,
        itemUpdates: buyUpdates,
      });
      await shop.updateEmbeddedDocuments('Item', buyUpdates);
      shopTelemetry('shopSocket', 'applyBasket updateEmbeddedDocuments complete', {
        shopId: shop?.id,
        shopUuid: shop?.uuid,
        targetActorId,
        stockAfterEmbeddedUpdate: itemQuantitySnapshot(shop?.items),
      });
    }

    for (const update of sellUpdates) {
      const sourceActor = resolveShopTargetActor(shop, update.__sourceActorId);
      if (!sourceActor) continue;
      const { __sourceActorId, ...cleanUpdate } = update;
      shopTelemetry('shopSocket', 'applyBasket reserve sell updateEmbeddedDocuments', {
        shopId: shop?.id,
        targetActorId,
        sourceActorId: update.__sourceActorId,
        itemUpdates: cleanUpdate,
      });
      await sourceActor.updateEmbeddedDocuments('Item', [cleanUpdate]);
    }
  }

  await shop.setFlag(MODULE_ID, `basket.${targetActorId}`, desiredBasket);
  shopTelemetry('shopSocket', 'applyBasket complete', {
    shopId: shop?.id,
    shopUuid: shop?.uuid,
    targetActorId,
    desiredBasket,
    stockUpdates,
    stockAfter: itemQuantitySnapshot(shop?.items),
    persistedBasket: shop.getFlag(MODULE_ID, `basket.${targetActorId}`) ?? [],
  });
  return { success: true, errors: [], basket: desiredBasket, stockUpdates };
}

async function applyPurchase({ requestId, shopId, shopUuid: requestedShopUuid, targetActorId, basket, userId }) {
  const shop = resolveShopDocument({ shopUuid: requestedShopUuid, shopId });
  const responseShopUuid = requestedShopUuid ?? shop?.uuid;
  const targetActor = resolveShopTargetActor(shop, targetActorId);
  const errors = [];
  const transactions = [];

  if (!shop) {
    errors.push('Shop not found');
  } else if (!targetActor) {
    errors.push('Target actor not found');
  } else {
    const reservedBasket = indexBasket(sanitizeBasket(shop.getFlag(MODULE_ID, `basket.${targetActorId}`) ?? []));
    const purchaseTotal = sumPrices((basket ?? []).map((entry) => ({
      price: entry.price,
      quantity: entry.quantity ?? 1,
    })));
    shopTelemetry('shopSocket', 'GM handling purchaseRequest', {
      requestId,
      shopId,
      requestedShopUuid,
      shopUuid: responseShopUuid,
      resolvedShopUuid: shop?.uuid,
      targetActorId,
      basket,
      purchaseTotal,
      reservedBasket: [...reservedBasket.values()],
      stockBefore: itemQuantitySnapshot(shop?.items),
      userId,
    });

    for (const entry of basket ?? []) {
      const shopItem = shop.items.get(entry.itemId);
      if (!shopItem) {
        errors.push(`Item ${entry.itemName} not found in shop`);
        continue;
      }

      const qty = Number(entry.quantity ?? 1);
      const reservedQty = Number(reservedBasket.get(entry.itemId)?.quantity ?? 0);
      if (reservedQty < qty) {
        errors.push(`Insufficient reserved stock for ${entry.itemName}`);
        continue;
      }

      if (qty <= 0) {
        errors.push(`Invalid quantity for ${entry.itemName}`);
      }
    }

    if (errors.length === 0) {
      const payment = await deductActorCurrency(targetActor, purchaseTotal);
      if (!payment.success) {
        errors.push(...payment.errors);
        shopTelemetry('shopSocket', 'purchaseRequest insufficient funds', {
          requestId,
          shopId,
          requestedShopUuid,
          shopUuid: responseShopUuid,
          targetActorId,
          targetActorName: targetActor.name,
          purchaseTotal,
          formattedTotal: Array.isArray(purchaseTotal)
            ? purchaseTotal.map((price) => formatPrice(price)).join(', ')
            : formatPrice(purchaseTotal),
          errors: payment.errors,
        });
      }
    }

    if (errors.length === 0) {
      for (const entry of basket ?? []) {
        const shopItem = shop.items.get(entry.itemId);
        const qty = Number(entry.quantity ?? 1);

        const itemData = shopItem.toObject();
        delete itemData._id;
        itemData.system.quantity = qty;

        await targetActor.createEmbeddedDocuments('Item', [itemData]);

        transactions.push({
          itemId: entry.itemId,
          itemName: entry.itemName,
          quantity: qty,
          price: getComparablePriceValue(entry.price),
          total: getComparablePriceValue(multiplyPrice(entry.price, qty)),
          currency: normalizePrice(entry.price).denomination,
          buyerId: targetActorId,
          buyerName: targetActor.name,
          direction: 'buy',
          timestamp: Date.now(),
          metadata: {
            price: makeBasketPrice(entry.price),
            total: multiplyPrice(entry.price, qty),
          },
        });
      }
    }

    if (transactions.length > 0) {
      // Credit the shop's vendor funds for the purchase total.
      const credit = await adjustVendorFunds(shop, purchaseTotal);
      if (!credit.success) {
        errors.push(...credit.errors);
      }
      await appendShopTransactions(shop, transactions);
      await shop.setFlag(MODULE_ID, `basket.${targetActorId}`, []);
    }
  }

  const resultBasket = errors.length === 0 ? [] : basket;
  shopTelemetry('shopSocket', 'purchaseRequest complete', {
    requestId,
    shopId,
    requestedShopUuid,
    shopUuid: responseShopUuid,
    resolvedShopUuid: shop?.uuid,
    targetActorId,
    success: errors.length === 0,
    errors,
    resultBasket,
    stockAfter: itemQuantitySnapshot(shop?.items),
  });

  return {
    kind: 'purchaseResult',
    requestId,
    shopId,
    shopUuid: responseShopUuid,
    shopUuids: getShopUuidAliases({ shopId, shopUuid: responseShopUuid, resolvedShopUuid: shop?.uuid }),
    resolvedShopUuid: shop?.uuid,
    targetActorId,
    basket: resultBasket,
    stockUpdates: [],
    success: errors.length === 0,
    errors,
    targetActorName: targetActor?.name ?? '',
    userId,
  };
}

async function applySell({ requestId, shopId, shopUuid, targetActorId, basket, userId }) {
  const errors = [];
  const transactions = [];
  let responseShopUuid = shopUuid;
  let targetActor = null;

  const shop = resolveShopDocument({ shopUuid, shopId });
  if (!shop) {
    errors.push('Shop not found');
  } else {
    responseShopUuid = getShopUuid(shop) ?? shopUuid;
    targetActor = resolveShopTargetActor(shop, targetActorId);
    if (!targetActor) {
      errors.push('Target actor not found');
    } else {
      const sellTotal = sumPrices((basket ?? []).map((entry) => ({
        price: entry.price,
        quantity: entry.quantity ?? 1,
      })));
      const vendorFunds = getVendorFunds(shop);
      const fundsCheck = subtractDenominationFunds(vendorFunds, sellTotal);
      shopTelemetry('shopSocket', 'GM handling sellRequest', {
        requestId,
        shopId,
        shopUuid,
        targetActorId,
        basket,
        sellTotal,
        vendorFunds,
        canAfford: fundsCheck.success,
        userId,
      });

      for (const entry of basket ?? []) {
        const sourceActor = resolveShopTargetActor(shop, entry.sourceActorId ?? targetActorId);
        if (!sourceActor) {
          errors.push(`Source actor for ${entry.itemName} not found`);
          continue;
        }
        const sourceItem = sourceActor.items.get(entry.itemId);
        if (!sourceItem) {
          errors.push(`Item ${entry.itemName} not found on source actor`);
          continue;
        }
        const qty = Number(entry.quantity ?? 1);
        const available = Number(sourceItem.system?.quantity ?? 0);
        if (available < qty) {
          errors.push(`Insufficient quantity of ${entry.itemName} to sell`);
          continue;
        }
        if (qty <= 0) {
          errors.push(`Invalid quantity for ${entry.itemName}`);
        }
      }

      if (!fundsCheck.success) {
        errors.push('Shop cannot afford this sale');
      }

      if (errors.length === 0) {
        for (const entry of basket ?? []) {
          const sourceActor = resolveShopTargetActor(shop, entry.sourceActorId ?? targetActorId);
          const sourceItem = sourceActor.items.get(entry.itemId);
          const qty = Number(entry.quantity ?? 1);
          const available = Number(sourceItem.system?.quantity ?? 0);

          if (available > qty) {
            await sourceActor.updateEmbeddedDocuments('Item', [
              { _id: entry.itemId, 'system.quantity': available - qty },
            ]);
          } else {
            await sourceActor.deleteEmbeddedDocuments('Item', [entry.itemId]);
          }

          const itemData = sourceItem.toObject();
          delete itemData._id;
          itemData.system.quantity = qty;
          await shop.createEmbeddedDocuments('Item', [itemData]);

          transactions.push({
            itemId: entry.itemId,
            itemName: entry.itemName,
            quantity: qty,
            price: getComparablePriceValue(entry.price),
            total: getComparablePriceValue(multiplyPrice(entry.price, qty)),
            currency: normalizePrice(entry.price).denomination,
            sellerId: targetActorId,
            sellerName: targetActor.name,
            direction: 'sell',
            timestamp: Date.now(),
            metadata: {
              price: makeBasketPrice(entry.price),
              total: multiplyPrice(entry.price, qty),
            },
          });
        }
      }

      if (transactions.length > 0) {
        const debitPrice = negatePrice(sellTotal);
        const debit = await adjustVendorFunds(shop, debitPrice);
        if (!debit.success) {
          errors.push(...debit.errors);
        }
        const credit = await addActorCurrency(targetActor, sellTotal);
        if (!credit.success) {
          errors.push(...credit.errors);
        }
        await appendShopTransactions(shop, transactions);
        await shop.setFlag(MODULE_ID, `basket.${targetActorId}`, []);
      }
    }
  }

  const resultBasket = errors.length === 0 ? [] : basket;
  shopTelemetry('shopSocket', 'sellRequest complete', {
    requestId,
    shopId,
    shopUuid,
    targetActorId,
    success: errors.length === 0,
    errors,
    resultBasket,
  });

  return {
    kind: 'sellResult',
    requestId,
    shopId,
    shopUuid: responseShopUuid,
    shopUuids: getShopUuidAliases({ shopId, shopUuid: responseShopUuid }),
    targetActorId,
    basket: resultBasket,
    success: errors.length === 0,
    errors,
    targetActorName: targetActor?.name ?? '',
    userId,
  };
}

function emitToSocket(payload) {
  shopTelemetry('shopSocket', 'emit socket payload', {
    kind: payload?.payload?.kind,
    requestId: payload?.payload?.requestId,
    shopId: payload?.payload?.shopId,
    shopUuid: payload?.payload?.shopUuid,
    targetActorId: payload?.payload?.targetActorId,
    success: payload?.payload?.success,
    basketLength: payload?.payload?.basket?.length,
    stockUpdates: payload?.payload?.stockUpdates,
    userId: payload?.payload?.userId,
  });
  game.socket.emit(SOCKET_NAME, payload);
}

function hasRegisteredShopDocumentStore(shop) {
  const shopUuid = getShopUuid(shop);
  return Boolean(shopUuid && getShopDocumentStores().has(shopUuid));
}

function refreshRegisteredShopDocumentStores(shop, options = {}) {
  if (!hasRegisteredShopDocumentStore(shop)) return;
  refreshShopDocumentStores(shop, options);
}

function withLocalShopUuidAliases(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return {
    ...payload,
    shopUuids: getShopUuidAliases(payload),
  };
}

function registerShopDocumentHooks() {
  if (window[SHOP_DOCUMENT_HOOKS_KEY]) return;
  window[SHOP_DOCUMENT_HOOKS_KEY] = true;

  Hooks.on('updateActor', (actor, data, options, userId) => {
    shopTelemetry('shopSocket', 'hook updateActor', {
      actorId: actor?.id,
      actorUuid: actor?.uuid,
      actorName: actor?.name,
      changedKeys: Object.keys(data ?? {}),
      data,
      options,
      userId,
      hasRegisteredStore: hasRegisteredShopDocumentStore(actor),
    });
    refreshRegisteredShopDocumentStores(actor, {
      action: 'shop-hook-update-actor',
      data,
      options,
      userId,
    });
  });

  Hooks.on('updateItem', (item, data, options, userId) => {
    shopTelemetry('shopSocket', 'hook updateItem', {
      itemId: item?.id,
      itemName: item?.name,
      parentId: item?.parent?.id,
      parentUuid: item?.parent?.uuid,
      changedKeys: Object.keys(data ?? {}),
      quantity: Number(item?.system?.quantity ?? 0),
      data,
      options,
      userId,
      hasRegisteredStore: hasRegisteredShopDocumentStore(item?.parent),
    });
    refreshRegisteredShopDocumentStores(item?.parent, {
      action: 'shop-hook-update-item',
      data,
      options,
      userId,
    });
  });

  Hooks.on('updateActorDelta', (actorDelta, data, options, userId) => {
    const token = actorDelta?.parent;
    const actor = token?.actor;
    shopTelemetry('shopSocket', 'hook updateActorDelta', {
      actorDeltaId: actorDelta?.id,
      tokenId: token?.id,
      tokenUuid: token?.uuid,
      actorId: actor?.id,
      actorUuid: actor?.uuid,
      actorName: actor?.name,
      changedKeys: Object.keys(data ?? {}),
      data,
      options,
      userId,
      hasRegisteredStore: hasRegisteredShopDocumentStore(actor),
    });
    refreshRegisteredShopDocumentStores(actor, {
      action: 'shop-hook-update-actor-delta',
      data,
      options,
      userId,
    });
  });
}

export function registerSocket() {
  if (!game?.socket) return;

  registerShopDocumentHooks();
  shopTelemetry('shopSocket', 'registerSocket', {
    socketName: SOCKET_NAME,
    hadExistingHandler: Boolean(window[SOCKET_HANDLER_KEY]),
  });

  const existingHandler = window[SOCKET_HANDLER_KEY];
  if (existingHandler) {
    game.socket.off(SOCKET_NAME, existingHandler);
  }

  const socketHandler = async (payload) => {
    if (payload?.type === 'ACTION') {
      shopTelemetry('shopSocket', 'received socket payload', {
        kind: payload?.payload?.kind,
        requestId: payload?.payload?.requestId,
        shopId: payload?.payload?.shopId,
        shopUuid: payload?.payload?.shopUuid,
        targetActorId: payload?.payload?.targetActorId,
        success: payload?.payload?.success,
        basketLength: payload?.payload?.basket?.length,
        stockUpdates: payload?.payload?.stockUpdates,
        userId: payload?.payload?.userId,
      });

      if (typeof payload.payload === 'string') {
        ui.notifications.info(payload.payload);
        return;
      }

      if (payload.payload?.kind === 'basketUpdateRequest') {
        if (!game.user.isGM) return;
        const { requestId, shopId, shopUuid: requestedShopUuid, targetActorId, nextBasket, userId } = payload.payload;
        try {
          const shop = resolveShopDocument({ shopUuid: requestedShopUuid, shopId });
          const responseShopUuid = requestedShopUuid ?? shop?.uuid;
          shopTelemetry('shopSocket', 'GM handling basketUpdateRequest', {
            requestId,
            shopId,
            requestedShopUuid,
            shopUuid: responseShopUuid,
            resolvedShopUuid: shop?.uuid,
            targetActorId,
            nextBasket,
            stockBefore: itemQuantitySnapshot(shop?.items),
            userId,
          });
          if (!shop || !targetActorId) {
            emitToSocket({ type: 'ACTION', payload: { kind: 'basketUpdateResult', requestId, success: false, errors: ['Invalid basket update request'], basket: [] } });
            return;
          }

          const result = await applyBasket(shop, targetActorId, nextBasket);
          recordShopSocketResult({ shopId, shopUuid: responseShopUuid, targetActorId, ...result });
          refreshShopDocumentStores(responseShopUuid, {
            action: 'shop-socket-gm-basket-update',
            requestId,
            userId,
          });
          if (shop?.uuid && shop.uuid !== responseShopUuid) {
            refreshShopDocumentStores(shop.uuid, {
              action: 'shop-socket-gm-basket-update-resolved-doc',
              requestId,
              userId,
            });
          }
          emitToSocket({ type: 'ACTION', payload: { kind: 'basketUpdateResult', requestId, shopId, shopUuid: responseShopUuid, targetActorId, ...result, userId } });
        } catch (error) {
          emitToSocket({ type: 'ACTION', payload: { kind: 'basketUpdateResult', requestId, shopId, shopUuid: requestedShopUuid, success: false, errors: [error?.message ?? 'Basket update failed'], basket: [] } });
        }
        return;
      }

      if (payload.payload?.kind === 'purchaseRequest') {
        if (!game.user.isGM) return;
        const { requestId, userId } = payload.payload;
        try {
          const resultPayload = await applyPurchase(payload.payload);
          recordShopSocketResult(resultPayload);
          refreshShopDocumentStores(resultPayload, {
            action: 'shop-socket-gm-purchase',
            requestId,
            userId,
          });
          if (resultPayload.resolvedShopUuid && resultPayload.resolvedShopUuid !== resultPayload.shopUuid) {
            refreshShopDocumentStores(resultPayload.resolvedShopUuid, {
              action: 'shop-socket-gm-purchase-resolved-doc',
              requestId,
              userId,
            });
          }

          emitToSocket({ type: 'ACTION', payload: resultPayload });
        } catch (error) {
          emitToSocket({
            type: 'ACTION',
            payload: {
              kind: 'purchaseResult',
              requestId: payload.payload.requestId,
              shopId: payload.payload.shopId,
              shopUuid: payload.payload.shopUuid,
              success: false,
              errors: [error?.message ?? 'Purchase failed'],
              targetActorName: '',
              userId: payload.payload.userId,
            },
          });
        }
        return;
      }

      if (payload.payload?.kind === 'sellRequest') {
        if (!game.user.isGM) return;
        const { requestId, userId } = payload.payload;
        try {
          const resultPayload = await applySell(payload.payload);
          recordShopSocketResult(resultPayload);
          refreshShopDocumentStores(resultPayload, {
            action: 'shop-socket-gm-sell',
            requestId,
            userId,
          });
          if (resultPayload.resolvedShopUuid && resultPayload.resolvedShopUuid !== resultPayload.shopUuid) {
            refreshShopDocumentStores(resultPayload.resolvedShopUuid, {
              action: 'shop-socket-gm-sell-resolved-doc',
              requestId,
              userId,
            });
          }

          emitToSocket({ type: 'ACTION', payload: resultPayload });
        } catch (error) {
          emitToSocket({
            type: 'ACTION',
            payload: {
              kind: 'sellResult',
              requestId: payload.payload.requestId,
              shopId: payload.payload.shopId,
              shopUuid: payload.payload.shopUuid,
              success: false,
              errors: [error?.message ?? 'Sell failed'],
              targetActorName: '',
              userId: payload.payload.userId,
            },
          });
        }
        return;
      }

      if (payload.payload?.kind === 'basketUpdateResult') {
        const resultPayload = withLocalShopUuidAliases(payload.payload);
        recordShopSocketResult(resultPayload);
        refreshShopDocumentStores(resultPayload);
      }

      const pendingBasket = getPendingRequests(PENDING_BASKET_KEY).get(payload.payload?.requestId);
      if (pendingBasket && payload.payload?.kind === 'basketUpdateResult') {
        getPendingRequests(PENDING_BASKET_KEY).delete(payload.payload.requestId);
        pendingBasket(payload.payload);
        return;
      }

      if (payload.payload?.kind === 'purchaseResult') {
        const resultPayload = withLocalShopUuidAliases(payload.payload);
        recordShopSocketResult(resultPayload);
        refreshShopDocumentStores(resultPayload);
      }

      const pendingPurchase = getPendingRequests(PENDING_PURCHASE_KEY).get(payload.payload?.requestId);
      if (pendingPurchase && payload.payload?.kind === 'purchaseResult') {
        getPendingRequests(PENDING_PURCHASE_KEY).delete(payload.payload.requestId);
        pendingPurchase(payload.payload);
      }

      if (payload.payload?.kind === 'sellResult') {
        const resultPayload = withLocalShopUuidAliases(payload.payload);
        recordShopSocketResult(resultPayload);
        refreshShopDocumentStores(resultPayload);
      }

      const pendingSell = getPendingRequests(PENDING_SELL_KEY).get(payload.payload?.requestId);
      if (pendingSell && payload.payload?.kind === 'sellResult') {
        getPendingRequests(PENDING_SELL_KEY).delete(payload.payload.requestId);
        pendingSell(payload.payload);
      }
    }
  };

  window[SOCKET_HANDLER_KEY] = socketHandler;
  game.socket.on(SOCKET_NAME, socketHandler);
}

export async function requestBasketUpdate({ shopId, shopUuid, targetActorId, nextBasket }) {
  shopTelemetry('shopSocket', 'requestBasketUpdate called', {
    shopId,
    shopUuid,
    targetActorId,
    nextBasket,
    isGM: game.user.isGM,
  });

  if (game.user.isGM) {
    const requestId = foundry.utils.randomID();
    const shop = resolveShopDocument({ shopUuid, shopId });
    const responseShopUuid = shopUuid ?? shop?.uuid;
    if (!shop || !targetActorId) {
      return { success: false, errors: ['Invalid basket update request'], basket: [] };
    }
    const result = await applyBasket(shop, targetActorId, nextBasket);
    const resultPayload = {
      kind: 'basketUpdateResult',
      requestId,
      shopId,
      shopUuid: responseShopUuid,
      shopUuids: getShopUuidAliases({ shopId, shopUuid: responseShopUuid }),
      resolvedShopUuid: shop?.uuid,
      targetActorId,
      ...result,
      userId: game.user.id,
    };
    recordShopSocketResult(resultPayload);
    refreshShopDocumentStores(resultPayload);
    if (shop?.uuid && shop.uuid !== responseShopUuid) {
      refreshShopDocumentStores(shop.uuid);
    }
    emitToSocket({ type: 'ACTION', payload: resultPayload });
    return result;
  }

  return await new Promise((resolve) => {
    const requestId = foundry.utils.randomID();
    shopTelemetry('shopSocket', 'queue pending basket request', {
      requestId,
      shopId,
      shopUuid,
      targetActorId,
      nextBasket,
    });
    getPendingRequests(PENDING_BASKET_KEY).set(requestId, resolve);
    emitToSocket({
      type: 'ACTION',
      payload: {
        kind: 'basketUpdateRequest',
        requestId,
        shopId,
        shopUuid,
        targetActorId,
        nextBasket,
        userId: game.user.id,
      },
    });
  });
}

export async function requestPurchase({ shopId, shopUuid, targetActorId, basket }) {
  if (game.user.isGM) {
    const requestId = foundry.utils.randomID();
    shopTelemetry('shopSocket', 'GM handling purchase locally', {
      requestId,
      shopId,
      shopUuid,
      targetActorId,
      basket,
    });
    const resultPayload = await applyPurchase({
      requestId,
      shopId,
      shopUuid,
      targetActorId,
      basket,
      userId: game.user.id,
    });
    recordShopSocketResult(resultPayload);
    refreshShopDocumentStores(resultPayload, {
      action: 'shop-socket-gm-purchase-local',
      requestId,
      userId: game.user.id,
    });
    if (resultPayload.resolvedShopUuid && resultPayload.resolvedShopUuid !== resultPayload.shopUuid) {
      refreshShopDocumentStores(resultPayload.resolvedShopUuid, {
        action: 'shop-socket-gm-purchase-local-resolved-doc',
        requestId,
        userId: game.user.id,
      });
    }
    emitToSocket({ type: 'ACTION', payload: resultPayload });
    return resultPayload;
  }

  return await new Promise((resolve) => {
    const requestId = foundry.utils.randomID();
    shopTelemetry('shopSocket', 'queue pending purchase request', {
      requestId,
      shopId,
      shopUuid,
      targetActorId,
      basket,
    });
    getPendingRequests(PENDING_PURCHASE_KEY).set(requestId, resolve);
    emitToSocket({
      type: 'ACTION',
      payload: {
        kind: 'purchaseRequest',
        requestId,
        shopId,
        shopUuid,
        targetActorId,
        basket,
        userId: game.user.id,
      },
    });
  });
}

export async function requestSell({ shopId, shopUuid, targetActorId, basket }) {
  if (game.user.isGM) {
    const requestId = foundry.utils.randomID();
    shopTelemetry('shopSocket', 'GM handling sell locally', {
      requestId,
      shopId,
      shopUuid,
      targetActorId,
      basket,
    });
    const resultPayload = await applySell({
      requestId,
      shopId,
      shopUuid,
      targetActorId,
      basket,
      userId: game.user.id,
    });
    recordShopSocketResult(resultPayload);
    refreshShopDocumentStores(resultPayload, {
      action: 'shop-socket-gm-sell-local',
      requestId,
      userId: game.user.id,
    });
    if (resultPayload.resolvedShopUuid && resultPayload.resolvedShopUuid !== resultPayload.shopUuid) {
      refreshShopDocumentStores(resultPayload.resolvedShopUuid, {
        action: 'shop-socket-gm-sell-local-resolved-doc',
        requestId,
        userId: game.user.id,
      });
    }
    emitToSocket({ type: 'ACTION', payload: resultPayload });
    return resultPayload;
  }

  return await new Promise((resolve) => {
    const requestId = foundry.utils.randomID();
    shopTelemetry('shopSocket', 'queue pending sell request', {
      requestId,
      shopId,
      shopUuid,
      targetActorId,
      basket,
    });
    getPendingRequests(PENDING_SELL_KEY).set(requestId, resolve);
    emitToSocket({
      type: 'ACTION',
      payload: {
        kind: 'sellRequest',
        requestId,
        shopId,
        shopUuid,
        targetActorId,
        basket,
        userId: game.user.id,
      },
    });
  });
}
