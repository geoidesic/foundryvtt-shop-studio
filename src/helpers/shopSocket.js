import { MODULE_ID } from '~/src/helpers/constants';

const SOCKET_NAME = `module.${MODULE_ID}`;
const SOCKET_HANDLER_KEY = `__${MODULE_ID}_socketHandler`;
const PENDING_BASKET_KEY = `__${MODULE_ID}_pendingBasketRequests`;
const PENDING_PURCHASE_KEY = `__${MODULE_ID}_pendingPurchaseRequests`;

function getPendingRequests(key) {
  if (!window[key]) {
    window[key] = new Map();
  }
  return window[key];
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
  return new Map((entries ?? []).map((entry) => [entry.itemId, entry]));
}

function getBasketPath(targetActorId) {
  return `flags.${MODULE_ID}.basket.${targetActorId}`;
}

async function applyBasket(shop, targetActorId, nextBasket) {
  const currentBasket = sanitizeBasket(shop.getFlag(MODULE_ID, `basket.${targetActorId}`) ?? []);
  const desiredBasket = sanitizeBasket(nextBasket);
  const currentByItem = indexBasket(currentBasket);
  const desiredByItem = indexBasket(desiredBasket);
  const itemIds = new Set([...currentByItem.keys(), ...desiredByItem.keys()]);

  for (const itemId of itemIds) {
    const prevQty = Number(currentByItem.get(itemId)?.quantity ?? 0);
    const nextQty = Number(desiredByItem.get(itemId)?.quantity ?? 0);
    const delta = nextQty - prevQty;
    if (delta <= 0) continue;

    const shopItem = shop.items.get(itemId);
    if (!shopItem) {
      return { success: false, errors: [`Item ${desiredByItem.get(itemId)?.itemName ?? itemId} not found in shop`], basket: currentBasket };
    }

    const available = Number(shopItem.system?.quantity ?? 0);
    if (available < delta) {
      return { success: false, errors: [`Insufficient stock for ${shopItem.name}`], basket: currentBasket };
    }
  }

  for (const itemId of itemIds) {
    const prevQty = Number(currentByItem.get(itemId)?.quantity ?? 0);
    const nextQty = Number(desiredByItem.get(itemId)?.quantity ?? 0);
    const delta = nextQty - prevQty;
    if (delta === 0) continue;

    const shopItem = shop.items.get(itemId);
    if (!shopItem) continue;

    const available = Number(shopItem.system?.quantity ?? 0);
    await shopItem.update({ 'system.quantity': available - delta });
  }

  await shop.setFlag(MODULE_ID, `basket.${targetActorId}`, desiredBasket);
  return { success: true, errors: [], basket: desiredBasket };
}

function emitToSocket(payload) {
  game.socket.emit(SOCKET_NAME, payload);
}

export function registerSocket() {
  if (!game?.socket) return;

  const existingHandler = window[SOCKET_HANDLER_KEY];
  if (existingHandler) {
    game.socket.off(SOCKET_NAME, existingHandler);
  }

  const socketHandler = async (payload) => {
    if (payload?.type === 'ACTION') {
      if (typeof payload.payload === 'string') {
        ui.notifications.info(payload.payload);
        return;
      }

      if (payload.payload?.kind === 'basketUpdateRequest') {
        if (!game.user.isGM) return;
        const { requestId, shopId, targetActorId, nextBasket, userId } = payload.payload;
        try {
          const shop = game.actors.get(shopId);
          if (!shop || !targetActorId) {
            emitToSocket({ type: 'ACTION', payload: { kind: 'basketUpdateResult', requestId, success: false, errors: ['Invalid basket update request'], basket: [] } });
            return;
          }

          const result = await applyBasket(shop, targetActorId, nextBasket);
          emitToSocket({ type: 'ACTION', payload: { kind: 'basketUpdateResult', requestId, ...result, userId } });
        } catch (error) {
          emitToSocket({ type: 'ACTION', payload: { kind: 'basketUpdateResult', requestId, success: false, errors: [error?.message ?? 'Basket update failed'], basket: [] } });
        }
        return;
      }

      if (payload.payload?.kind === 'purchaseRequest') {
        if (!game.user.isGM) return;
        const { requestId, shopId, targetActorId, basket, userId } = payload.payload;
        try {
          const shop = game.actors.get(shopId);
          const targetActor = game.actors.get(targetActorId);
          const errors = [];
          const transactions = [];

          if (!shop) {
            errors.push('Shop not found');
          } else if (!targetActor) {
            errors.push('Target actor not found');
          } else {
            for (const entry of basket) {
              const shopItem = shop.items.get(entry.itemId);
              if (!shopItem) {
                errors.push(`Item ${entry.itemName} not found in shop`);
                continue;
              }

              const avail = Number(shopItem.system?.quantity ?? 0);
              const qty = Number(entry.quantity ?? 1);
              if (avail < qty) {
                errors.push(`Insufficient stock for ${entry.itemName}`);
                continue;
              }

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
              await shop.update({ system: { transactions: [...shop.system.transactions, ...transactions] } });
            }
          }

          emitToSocket({
            type: 'ACTION',
            payload: {
              kind: 'purchaseResult',
              requestId,
              success: errors.length === 0,
              errors,
              targetActorName: targetActor?.name ?? '',
              userId,
            },
          });
        } catch (error) {
          emitToSocket({
            type: 'ACTION',
            payload: {
              kind: 'purchaseResult',
              requestId: payload.payload.requestId,
              success: false,
              errors: [error?.message ?? 'Purchase failed'],
              targetActorName: '',
              userId: payload.payload.userId,
            },
          });
        }
        return;
      }

      const pendingBasket = getPendingRequests(PENDING_BASKET_KEY).get(payload.payload?.requestId);
      if (pendingBasket && payload.payload?.kind === 'basketUpdateResult') {
        getPendingRequests(PENDING_BASKET_KEY).delete(payload.payload.requestId);
        pendingBasket(payload.payload);
        return;
      }

      const pendingPurchase = getPendingRequests(PENDING_PURCHASE_KEY).get(payload.payload?.requestId);
      if (pendingPurchase && payload.payload?.kind === 'purchaseResult') {
        getPendingRequests(PENDING_PURCHASE_KEY).delete(payload.payload.requestId);
        pendingPurchase(payload.payload);
      }
    }
  };

  window[SOCKET_HANDLER_KEY] = socketHandler;
  game.socket.on(SOCKET_NAME, socketHandler);
}

export async function requestBasketUpdate({ shopId, targetActorId, nextBasket }) {
  if (game.user.isGM) {
    const shop = game.actors.get(shopId);
    if (!shop || !targetActorId) {
      return { success: false, errors: ['Invalid basket update request'], basket: [] };
    }
    return await applyBasket(shop, targetActorId, nextBasket);
  }

  return await new Promise((resolve) => {
    const requestId = foundry.utils.randomID();
    getPendingRequests(PENDING_BASKET_KEY).set(requestId, resolve);
    emitToSocket({
      type: 'ACTION',
      payload: {
        kind: 'basketUpdateRequest',
        requestId,
        shopId,
        targetActorId,
        nextBasket,
        userId: game.user.id,
      },
    });
  });
}

export async function requestPurchase({ shopId, targetActorId, basket }) {
  return await new Promise((resolve) => {
    const requestId = foundry.utils.randomID();
    getPendingRequests(PENDING_PURCHASE_KEY).set(requestId, resolve);
    emitToSocket({
      type: 'ACTION',
      payload: {
        kind: 'purchaseRequest',
        requestId,
        shopId,
        targetActorId,
        basket,
        userId: game.user.id,
      },
    });
  });
}
