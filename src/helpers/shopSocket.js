import { MODULE_ID } from '~/src/helpers/constants';

const SOCKET_NAME = `module.${MODULE_ID}`;

function getBasketFlagPath(targetActorId) {
  return `basket.${targetActorId}`;
}

function sanitizeBasket(entries) {
  return (entries ?? [])
    .filter((entry) => entry?.itemId)
    .map((entry) => ({
      itemId: entry.itemId,
      itemName: entry.itemName,
      img: entry.img,
      price: Number(entry.price ?? 0),
      quantity: Math.max(0, Number(entry.quantity ?? 0)),
    }))
    .filter((entry) => entry.quantity > 0);
}

function indexBasket(entries) {
  const map = new Map();
  for (const entry of entries) map.set(entry.itemId, entry);
  return map;
}

async function applyBasketReservation(shop, targetActorId, nextBasket) {
  const errors = [];
  const flagPath = getBasketFlagPath(targetActorId);
  const currentBasket = sanitizeBasket(shop.getFlag(MODULE_ID, flagPath) ?? []);
  const desiredBasket = sanitizeBasket(nextBasket);

  const currentByItem = indexBasket(currentBasket);
  const desiredByItem = indexBasket(desiredBasket);
  const itemIds = new Set([...currentByItem.keys(), ...desiredByItem.keys()]);

  // First pass: validate positive deltas against current stock.
  for (const itemId of itemIds) {
    const prevQty = Number(currentByItem.get(itemId)?.quantity ?? 0);
    const nextQty = Number(desiredByItem.get(itemId)?.quantity ?? 0);
    const delta = nextQty - prevQty;
    if (delta <= 0) continue;

    const shopItem = shop.items.get(itemId);
    if (!shopItem) {
      errors.push(`Item ${currentByItem.get(itemId)?.itemName ?? desiredByItem.get(itemId)?.itemName ?? itemId} not found in shop`);
      continue;
    }

    const available = Number(shopItem.system?.quantity ?? 0);
    if (available < delta) {
      errors.push(`Insufficient stock for ${shopItem.name}`);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors, basket: currentBasket };
  }

  // Second pass: apply stock movements.
  for (const itemId of itemIds) {
    const prevQty = Number(currentByItem.get(itemId)?.quantity ?? 0);
    const nextQty = Number(desiredByItem.get(itemId)?.quantity ?? 0);
    const delta = nextQty - prevQty;
    if (delta === 0) continue;

    const shopItem = shop.items.get(itemId);
    if (!shopItem) continue;

    const available = Number(shopItem.system?.quantity ?? 0);
    if (delta > 0) {
      await shopItem.update({ 'system.quantity': available - delta });
    } else {
      await shopItem.update({ 'system.quantity': available + Math.abs(delta) });
    }
  }

  await shop.setFlag(MODULE_ID, flagPath, desiredBasket);
  return { success: true, errors: [], basket: desiredBasket };
}

export function registerSocket() {
  game.socket.on(SOCKET_NAME, async (payload) => {
    window.GAS.log.p('registerSocket | received socket payload:', payload.action, '| user is GM:', game.user.isGM);
    if (!game.user.isGM) return;

    if (payload.action === 'basketUpdate') {
      await handleBasketUpdate(payload);
    }

    if (payload.action === 'processPurchase') {
      await handleProcessPurchase(payload);
    }
  });
}

/**
 * Called by a client to request a basket update that moves quantity between
 * shop inventory and basket reservation for a target actor.
 *
 * @param {object} opts
 * @param {string} opts.shopId
 * @param {string} opts.targetActorId
 * @param {Array}  opts.nextBasket
 * @returns {Promise<{ success: boolean, errors: string[], basket: Array }>} 
 */
export function requestBasketUpdate({ shopId, targetActorId, nextBasket }) {
  window.GAS.log.p('requestBasketUpdate | creating basket update request for shop:', shopId, '| targetActor:', targetActorId, '| entries:', nextBasket?.length ?? 0);

  if (game.user.isGM) {
    return (async () => {
      const shop = game.actors.get(shopId);
      if (!shop || !targetActorId) {
        return { success: false, errors: ['Invalid basket update request'], basket: [] };
      }
      return applyBasketReservation(shop, targetActorId, nextBasket);
    })();
  }

  return new Promise((resolve) => {
    const requestId = foundry.utils.randomID();
    window.GAS.log.p('requestBasketUpdate | requestId:', requestId);
    let settled = false;

    const handler = (payload) => {
      window.GAS.log.p('requestBasketUpdate | received payload:', payload?.action, '| requestId matches:', payload?.requestId === requestId);
      if (payload.action === 'basketUpdateResult' && payload.requestId === requestId) {
        settled = true;
        game.socket.off(SOCKET_NAME, handler);
        window.GAS.log.p('requestBasketUpdate | resolving with result:', payload.success, '| errors:', payload.errors?.length || 0);
        resolve(payload);
      }
    };
    game.socket.on(SOCKET_NAME, handler);

    const timeoutMs = 5000;
    setTimeout(() => {
      if (settled) return;
      game.socket.off(SOCKET_NAME, handler);
      window.GAS.log.e('requestBasketUpdate | timed out waiting for GM response. Ensure GM client reloaded with latest socket handler.');
      resolve({ success: false, errors: ['Timed out waiting for GM basket handler response'], basket: [] });
    }, timeoutMs);

    window.GAS.log.p('requestBasketUpdate | emitting socket event to GM');
    game.socket.emit(SOCKET_NAME, {
      action: 'basketUpdate',
      requestId,
      shopId,
      targetActorId,
      nextBasket,
      userId: game.user.id,
    });
  });
}

/**
 * Called by a player to ask a GM client to finalize the purchase.
 * Returns a Promise that resolves when the GM emits back a result.
 *
 * @param {object} opts
 * @param {string} opts.shopId
 * @param {string} opts.targetActorId
 * @param {Array}  opts.basket  - array of { itemId, itemName, quantity, price }
 * @returns {Promise<{ success: boolean, errors: string[] }>}
 */
export function requestPurchase({ shopId, targetActorId, basket }) {
  window.GAS.log.p('requestPurchase | creating purchase request for shop:', shopId, '| targetActor:', targetActorId, '| basket items:', basket.length);
  return new Promise((resolve) => {
    const requestId = foundry.utils.randomID();
    window.GAS.log.p('requestPurchase | requestId:', requestId);

    // Listen for the response
    const handler = (payload) => {
      window.GAS.log.p('requestPurchase | received response payload:', payload.action, '| requestId matches:', payload.requestId === requestId);
      if (payload.action === 'purchaseResult' && payload.requestId === requestId) {
        window.GAS.log.p('requestPurchase | resolving with result:', payload.success, '| errors:', payload.errors?.length || 0);
        game.socket.off(SOCKET_NAME, handler);
        resolve(payload);
      }
    };
    game.socket.on(SOCKET_NAME, handler);

    window.GAS.log.p('requestPurchase | emitting socket event to GM');
    game.socket.emit(SOCKET_NAME, {
      action: 'processPurchase',
      requestId,
      shopId,
      targetActorId,
      basket,
      userId: game.user.id,
    });
  });
}

async function handleBasketUpdate(payload) {
  const { requestId, shopId, targetActorId, nextBasket, userId } = payload;
  window.GAS.log.p('handleBasketUpdate | GM received request:', requestId, '| shop:', shopId, '| targetActor:', targetActorId, '| entries:', nextBasket?.length ?? 0);

  try {
    const shop = game.actors.get(shopId);

    if (!shop || !targetActorId) {
      game.socket.emit(SOCKET_NAME, {
        action: 'basketUpdateResult',
        requestId,
        success: false,
        errors: ['Invalid basket update request'],
        basket: [],
        userId,
      });
      return;
    }

    const result = await applyBasketReservation(shop, targetActorId, nextBasket);
    window.GAS.log.p('handleBasketUpdate | reservation result:', result.success, '| errors:', result.errors?.length || 0, '| basket size:', result.basket?.length || 0);

    game.socket.emit(SOCKET_NAME, {
      action: 'basketUpdateResult',
      requestId,
      success: result.success,
      errors: result.errors,
      basket: result.basket,
      userId,
    });
  } catch (error) {
    window.GAS.log.e('handleBasketUpdate | error while processing basket update', error);
    game.socket.emit(SOCKET_NAME, {
      action: 'basketUpdateResult',
      requestId,
      success: false,
      errors: [error?.message ?? 'Basket update failed'],
      basket: [],
      userId,
    });
  }
}

async function handleProcessPurchase(payload) {
  const { requestId, shopId, targetActorId, basket, userId } = payload;
  const shop = game.actors.get(shopId);
  const targetActor = game.actors.get(targetActorId);

  window.GAS.log.p('handleProcessPurchase | shop:', shop?.name, '| targetActor:', targetActor?.name, '| items:', basket?.length);

  const errors = [];
  const transactions = [];

  if (!shop) {
    errors.push('Shop not found');
  } else if (!targetActor) {
    errors.push('Target actor not found');
  } else {
    window.GAS.log.p('handleProcessPurchase | processing purchase for shop:', shop.name, '| target:', targetActor.name, '| basket items:', basket.length);
    for (const entry of basket) {
      const shopItem = shop.items.get(entry.itemId);
      if (!shopItem) {
        errors.push(`Item ${entry.itemName} not found in shop`);
        continue;
      }

      const avail = shopItem.system?.quantity ?? 0;
      const qty = entry.quantity ?? 1;

      if (avail < qty) {
        errors.push(`Insufficient stock for ${entry.itemName}`);
        continue;
      }

      window.GAS.log.p('handleProcessPurchase | deducting stock for item:', shopItem.name, '| available:', avail, '| quantity:', qty, '| remaining:', avail - qty);
      const itemData = shopItem.toObject();
      delete itemData._id;
      itemData.system.quantity = qty;

      await targetActor.createEmbeddedDocuments('Item', [itemData]);
      await shopItem.update({ 'system.quantity': avail - qty });

      transactions.push({
        itemId: entry.itemId,
        itemName: entry.itemName,
        quantity: qty,
        price: entry.price ?? 0,
        total: (entry.price ?? 0) * qty,
        buyerId: targetActorId,
        buyerName: targetActor.name,
        timestamp: Date.now(),
      });
    }

    if (transactions.length > 0 && shop.system?.transactions) {
      window.GAS.log.p('handleProcessPurchase | adding transactions to shop:', transactions.length);
      await shop.update({
        system: { transactions: [...shop.system.transactions, ...transactions] },
      });
    }
  }

  window.GAS.log.p('handleProcessPurchase | purchase complete, errors:', errors.length, '| transactions:', transactions.length);
  // Respond to the requesting user
  game.socket.emit(SOCKET_NAME, {
    action: 'purchaseResult',
    requestId,
    success: errors.length === 0,
    errors,
    targetActorName: targetActor?.name ?? '',
    userId,
  });
}
