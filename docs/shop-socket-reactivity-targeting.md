# Shop Socket, Reactivity, and Targeting Methodology

> Last updated: 2026-07-07

This document records the implementation approach used for cross-client shop basket updates, Svelte reactivity, inventory quantity updates, and shop target actor selection.

## Goals

- Keep the shop sheet reactive across GM and player clients.
- Route player basket requests through the GM, because the GM owns the shop document and performs stock reservation.
- Avoid direct embedded item updates that bypass the sheet document store.
- Avoid huge GM basket actor lists. The GM should see shop-targeted actors, not every owned actor, associated actor, or actor with historical basket data.
- Support token actors as well as base actors, because a shop sheet may be opened from a scene token and expose a token actor UUID such as `Scene...Token...Actor...`.

## Core Concepts

### Shop Identity Aliases

A single shop can be observed under multiple document identities:

- Base actor UUID: `Actor.<actorId>`
- Token actor UUID: `Scene.<sceneId>.Token.<tokenId>.Actor.<actorId>`
- Raw actor id: `<actorId>`

Socket state and document refreshes must treat these as aliases for the same logical shop. `src/helpers/shopSocket.js` normalizes and expands these aliases, and `src/stores/basketState.js` records socket results under every relevant shop UUID.

### Shop Document Store Registry

Shop sheets register their existing `TJSDocument` store with the socket helper while mounted.

Why:

- Socket updates can arrive without Svelte seeing a direct local document mutation.
- Token actor sheets may be registered under a token actor UUID.
- Refreshing only `Actor.<id>` is insufficient when the visible sheet is using `Scene...Token...Actor...`.

The refresh path intentionally sets the store to `undefined` and then sets the resolved document again in a microtask. This forces a fresh Svelte store emission when Foundry/TJSDocument would otherwise retain references.

## Basket Socket Flow

### Player Request

When a player changes a basket:

1. The player tab calls `requestBasketUpdate({ shopId, shopUuid, targetActorId, nextBasket })`.
2. The request is emitted over `game.socket` as `basketUpdateRequest`.
3. The GM receives the request and resolves the shop document.
4. The GM applies stock reservation and persists the basket flag.
5. The GM emits `basketUpdateResult`.
6. Every client records the result in `shopSocketState` and refreshes any registered shop document store aliases.

### GM Direct Request

When the GM changes a basket from the GM sheet, the flow still uses `requestBasketUpdate`.

Important rule: even though the GM can apply the update locally, the GM branch must still emit a `basketUpdateResult` so player clients update. Without this, GM -> player reactivity breaks while player -> GM reactivity still works.

### Basket Storage

Basket contents are stored on the shop actor flag:

```text
flags.foundryvtt-shop-studio.basket.<targetActorId>
```

Socket results are mirrored in `shopSocketState`:

```js
{
  basketsByActorId: Map<actorId, basketEntries>,
  stockByItemId: Map<itemId, quantity>,
  revision: number
}
```

`BasketTab.svelte` prefers socket basket state when present, then falls back to document flags.

## Inventory Reactivity

### Write Path

Inventory quantity changes must go through actor-level embedded document updates:

```js
await $Actor.updateEmbeddedDocuments('Item', [{
  _id: item.id,
  'system.quantity': quantity,
}]);
```

Do not update stock with `item.update(...)` in shop inventory flows. Direct item updates can bypass the sheet-level `TJSDocument` store and leave Svelte reducers stale.

### Read Path

Inventory tabs derive item rows from the current actor document's embedded item collection values:

```js
const source = typeof $Actor?.items?.values === 'function'
  ? $Actor.items.values()
  : ($Actor?.items ?? []);
return Array.from(source);
```

This avoids depending on Foundry collection iterator behavior and avoids stale `DynMapReducer` output after remote socket updates.

### Quantity Display

Displayed quantity is derived from socket stock state when available, then the document quantity:

```js
const socketStock = socketShopState?.stockByItemId?.get(item?.id);
const stock = Number(socketStock ?? item?.system?.quantity ?? 0);
```

This makes remote reservation results visible even when the embedded item reducer has not re-emitted yet.

### Reservation Semantics

Adding an item to a basket reserves stock immediately by decrementing the shop item quantity. Because stock is already decremented, the display must not subtract basket reservation again.

Correct display rule:

```js
return Math.max(0, stock);
```

Incorrect display rule:

```js
return Math.max(0, stock - reserved);
```

## Purchase Semantics

Basket reservation already decrements stock. Purchase should not decrement the shop stock a second time.

Purchase should:

- Validate that the requested purchase quantity is present in the reserved basket.
- Create item documents on the target actor.
- Record transactions.
- Clear the basket flag for the target actor after success.
- Broadcast `purchaseResult`.

## Targeting Methodology

### Problem

Listing all owned actors is too noisy:

- GMs may own or control many NPCs.
- Players may own multiple actors.
- Associated actor lists are shop configuration, not basket target state.
- Basket keys can include stale historical actors.

The GM basket actor selector should show actors targeted by this shop, not broad ownership or historical state.

### Shop Target Registry

Shop targets are stored on the shop actor flag:

```text
flags.foundryvtt-shop-studio.targetedActors
```

Each entry stores normalized actor metadata:

```js
{
  actorId,
  actorUuid,
  tokenUuid,
  name,
  img,
  userId,
  source,
  timestamp,
}
```

The helper lives in `src/helpers/shopTargets.js`.

### Player Selection

When a player selects an actor in the basket tab:

1. The selected actor id is stored as a user flag:

   ```text
   flags.foundryvtt-shop-studio.selectedActor.<shopId>
   ```

2. The actor is registered in the shop's `targetedActors` flag.

This means the GM can see the actor as a shop target without listing every actor the player owns.

Restored legacy selections are also registered, so old sessions backfill into the new target registry when opened.

### GM Selection

The GM basket actor selector reads only:

- actors registered in `targetedActors`
- the GM's current Foundry token targets from `game.user.targets`

Current token targets are transient until selected. Selecting one persists it into `targetedActors`, preserving token metadata.

### Token Actors

Target entries preserve `actorUuid` and `tokenUuid`. This is important because token actors can differ from their base actor, and Foundry target workflows frequently operate on token actor UUIDs.

Actor resolution should use `resolveShopTargetActor(shop, targetActorId)` rather than `game.actors.get(targetActorId)` when basket or purchase logic is operating on a shop target.

## Telemetry

Telemetry is intentionally verbose while these flows are settling. Useful event groups:

- `shopSocket`
- `basketState`
- `BasketTab`
- `InventoryTab`
- `InventoryPlayerTab`
- `ShopSheetGM`
- `ShopSheetPlayer`
- `shopTargets`

Useful things to confirm from logs:

- Result payload includes `shopId`, `shopUuid`, and local `shopUuids` aliases.
- `basketState` records the result under both base actor and token actor aliases when applicable.
- `BasketTab` sees the target actor id in `shopTargetActorIds`.
- Inventory display quantity logs show `socketStock` when a socket result provided stock updates.

## Rules of Thumb

- Always pass `shopUuid` as well as `shopId` in socket calls.
- Record socket results under all known aliases, not just the incoming UUID.
- GM-local basket changes must still emit socket results.
- Use actor-level `updateEmbeddedDocuments('Item', ...)` for shop stock changes.
- Derive inventory rows from `$Actor.items.values()`.
- Do not subtract reserved basket quantity from displayed stock after reservation has decremented item quantity.
- Resolve basket target actors through `shopTargets`, especially for token actors.
- Keep GM basket actor selection target-driven; do not repopulate it from all owned actors, all associated actors, or all historical basket keys.

## Related Files

- `src/helpers/shopSocket.js`
- `src/stores/basketState.js`
- `src/helpers/shopTargets.js`
- `src/components/sheets/ShopSheet.svelte`
- `src/components/sheets/ShopSheetGM.svelte`
- `src/components/sheets/ShopSheetPlayer.svelte`
- `src/components/sheets/tabs/BasketTab.svelte`
- `src/components/sheets/tabs/InventoryTab.svelte`
- `src/components/sheets/tabs/InventoryPlayerTab.svelte`
- `src/helpers/telemetry.js`
