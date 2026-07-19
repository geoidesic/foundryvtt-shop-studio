<script>
  import { getContext, onDestroy, onMount } from "svelte";
  import { rippleFocus } from "#standard/action/animate/composable";
  import { TJSDocument } from "#runtime/svelte/store/fvtt/document";

  import { TJSInput } from "#standard/component/form";
  import { createFilterQuery, createSortQuery } from "~/src/filters/itemFilterQuery";
  import { getComparablePriceValue } from "~/src/helpers/currency.js";
  import { localize } from "~/src/helpers/utility";
  import { MODULE_ID } from "~/src/helpers/constants";
  import { applyPriceFactor, formatPrice as formatCurrencyPrice, makeBasketPrice } from "~/src/helpers/currency.js";
  import { getConfiguredListableItemTypes } from "~/src/helpers/itemSources";
  import { requestBasketUpdate, requestSell } from "~/src/helpers/shopSocket.js";
  import { shopSocketState } from "~/src/stores/basketState.js";
  import { itemQuantitySnapshot, shopTelemetry } from "~/src/helpers/telemetry.js";
  import { getBuyPrice } from "~/src/helpers/currency.js";
  import DropZone from "~/src/components/molecules/DropZone.svelte";
  import { resolveShopTargetActor } from "~/src/helpers/shopTargets.js";

  const Actor = getContext("#doc");
  const doc = new TJSDocument($Actor);

  $: doc.set($Actor);

  export let sharedProps = {};

  $: targetActorId = sharedProps.targetActorId ?? null;
  $: shopUuid = $Actor?.uuid ?? ($Actor?.id ? `Actor.${$Actor.id}` : null);
  $: socketShopState = shopUuid ? $shopSocketState.get(shopUuid) : null;
  $: socketStockRevision = socketShopState?.revision ?? 0;
  const typeSearch = createFilterQuery("type");
  const nameSearch = createFilterQuery("name");
  const sortQuery = createSortQuery({
    defaultKey: "name",
    defaultDirection: "asc",
    resolvers: { price: (item) => getComparablePriceValue(item?.system?.price) },
  });

  const input = {
    store: nameSearch,
    efx: rippleFocus(),
    placeholder: "by Name",
    type: "search",
    id: "search",
  };

  let typeFilterValue = "all";
  let items = [];
  let unsubscribeActor = () => {};
  let unsubscribeWildcard = () => {};

  $: typeFilterOptions = [
    { value: "all", label: "All" },
    ...getConfiguredListableItemTypes().map((t) => ({
      value: t.type,
      label: t.label,
    })),
  ];

  /** @type {import('@typhonjs-fvtt/runtime/svelte/store').DynMapReducer<string, Item>} */
  const wildcard = doc.embedded.create(Item, {
    name: "wildcard",
    filters: [typeSearch, nameSearch],
    sort: (a, b) => a.name.localeCompare(b.name),
  });

  function showItemSheet(item) {
    item.sheet.render(true);
  }

  function onShowItemClick(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    items[idx].sheet.render(true);
  }

  function onAddToBasketClick(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    shopTelemetry('InventoryPlayerTab', 'add button clicked', {
      index: idx,
      itemId: items[idx]?.id,
      itemName: items[idx]?.name,
      displayQuantity: items[idx] ? getDisplayQuantity(items[idx]) : null,
    });
    addToBasket(items[idx]);
  }

  function onTypeFilterChange(e) {
    typeFilterValue = e.target.value;
  }

  function getActorItems() {
    const source = typeof $Actor?.items?.values === "function"
      ? $Actor.items.values()
      : ($Actor?.items ?? []);
    return Array.from(source);
  }

  function getInventoryItems() {
    return getActorItems()
      .filter((item) => typeSearch(item) && nameSearch(item))
      .sort(sortQuery);
  }

  function onSortClick(e) {
    const key = e.currentTarget.dataset.key;
    shopTelemetry('InventoryPlayerTab', 'sort header clicked', {
      key,
      previousSortKey: sortKey,
      previousSortDir: sortDir,
    });
    sortQuery.toggle(key);
    sortKey = sortQuery.getKey();
    sortDir = sortQuery.getDirection();
    shopTelemetry('InventoryPlayerTab', 'sort header applied', {
      key,
      nextSortKey: sortKey,
      nextSortDir: sortDir,
      itemCount: items.length,
    });
  }

  let sortKey = sortQuery.getKey();
  let sortDir = sortQuery.getDirection();

  function getDisplayQuantity(item) {
    const socketStock = socketShopState?.stockByItemId?.get(item?.id);
    const stock = Number(socketStock ?? item?.system?.quantity ?? 0);
    shopTelemetry('InventoryPlayerTab', 'display quantity evaluated', {
      shopUuid,
      itemId: item?.id,
      itemName: item?.name,
      documentQuantity: Number(item?.system?.quantity ?? 0),
      socketStock,
      result: Math.max(0, stock),
      socketStockRevision,
    });
    return Math.max(0, stock);
  }

  function isOutOfStock(item) {
    return getDisplayQuantity(item) <= 0;
  }

  function formatPrice(item) {
    return formatCurrencyPrice(getSalePrice(item));
  }

  function getSalePrice(item) {
    return applyPriceFactor(item?.system?.price, sharedProps.salePriceFactor ?? 100);
  }

  /** Add item to the player's basket (stored in a flag on the current user). */
  async function addToBasket(item) {
    shopTelemetry('InventoryPlayerTab', 'addToBasket start', {
      shopId: $Actor?.id,
      shopUuid: $Actor?.uuid,
      targetActorId,
      itemId: item?.id,
      itemName: item?.name,
      itemQuantity: Number(item?.system?.quantity ?? 0),
      displayQuantity: item ? getDisplayQuantity(item) : null,
      currentBasket: targetActorId ? ($Actor?.flags?.[MODULE_ID]?.basket?.[targetActorId] ?? []) : [],
      allBasketActorIds: Object.keys($Actor?.flags?.[MODULE_ID]?.basket ?? {}),
    });

    if (!targetActorId) {
      ui.notifications.warn(localize('NoTargetActor'));
      return;
    }

    const shopId = $Actor.id;
    if (isOutOfStock(item)) {
      ui.notifications.warn(game.i18n.format('InsufficientStock', { itemName: item.name }));
      return;
    }

    const currentBasket = targetActorId ? ($Actor?.flags?.[MODULE_ID]?.basket?.[targetActorId] ?? []) : [];
    const nextBasket = currentBasket.map((entry) => ({ ...entry }));
    
    const existing = nextBasket.find((entry) => entry.itemId === item.id);
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + 1;
    } else {
      nextBasket.push({
        itemId: item.id,
        itemName: item.name,
        img: item.img,
        price: makeBasketPrice(getSalePrice(item)),
        quantity: 1,
      });
    }
    
    const result = await requestBasketUpdate({
      shopId,
      shopUuid: $Actor.uuid,
      targetActorId,
      nextBasket,
    });
    shopTelemetry('InventoryPlayerTab', 'addToBasket socket result', {
      shopId,
      targetActorId,
      result,
    });
    if (!result.success) {
      (result.errors ?? []).forEach((err) => ui.notifications.warn(err));
      return;
    }
    
    ui.notifications.info(`${item.name} added to basket`);
  }

  /** Resolve a dropped item into a sell basket entry for the selected target actor. */
  async function handleSellDrop(data) {
    shopTelemetry('InventoryPlayerTab', 'sell drop received', {
      shopId: $Actor?.id,
      shopUuid: $Actor?.uuid,
      targetActorId,
      dataType: data?.type,
      dataUuid: data?.uuid,
    });

    if (!targetActorId) {
      ui.notifications.warn(localize('NoTargetActor'));
      return;
    }

    if (data?.type !== 'Item' || !data?.uuid) {
      return;
    }

    const sourceItem = await fromUuid(data.uuid);
    if (!sourceItem) return;

    const sourceActor = sourceItem.actor;
    if (!sourceActor) {
      ui.notifications.warn(localize('SellFromWrongActor'));
      return;
    }

    if (sourceActor.id !== targetActorId) {
      ui.notifications.warn(localize('SellFromWrongActor'));
      return;
    }

    const maxQty = Number(sourceItem.system?.quantity ?? 0);
    if (maxQty <= 0) {
      ui.notifications.warn(localize('InsufficientStock'));
      return;
    }

    let quantity = 1;
    if (sharedProps.sellQuantityMode === 'prompt') {
      const promptValue = await Dialog.prompt({
        title: localize('SelectSellQuantity'),
        content: `<p>${localize('SelectSellQuantity')}</p>`,
        rejectClose: false,
        callback: (html) => {
          const input = html.querySelector('input');
          return input ? Number(input.value) : 1;
        },
        options: { width: 320 },
      }).catch(() => null);
      quantity = Number(promptValue ?? 1);
    }

    quantity = Math.min(Math.max(1, quantity), maxQty);

    const sellPrice = getBuyPrice(sourceItem, sharedProps.buyPriceFactor ?? 50);
    if (!sellPrice || getComparablePriceValue(sellPrice) <= 0) {
      ui.notifications.warn(localize('NoItemPrice'));
      return;
    }

    const currentBasket = targetActorId ? ($Actor?.flags?.[MODULE_ID]?.basket?.[targetActorId] ?? []) : [];
    const nextBasket = currentBasket.map((entry) => ({ ...entry }));

    const existing = nextBasket.find((entry) => entry.itemId === sourceItem.id && entry.direction === 'sell');
    if (existing) {
      existing.quantity = Math.min(maxQty, (existing.quantity ?? 1) + quantity);
    } else {
      nextBasket.push({
        itemId: sourceItem.id,
        itemName: sourceItem.name,
        img: sourceItem.img,
        price: makeBasketPrice(sellPrice),
        quantity,
        direction: 'sell',
        sourceActorId: targetActorId,
      });
    }

    const result = await requestBasketUpdate({
      shopId: $Actor.id,
      shopUuid: $Actor.uuid,
      targetActorId,
      nextBasket,
    });
    shopTelemetry('InventoryPlayerTab', 'sell drop basket update result', {
      shopId: $Actor?.id,
      targetActorId,
      result,
    });
    if (!result.success) {
      (result.errors ?? []).forEach((err) => ui.notifications.warn(err));
      return;
    }
    ui.notifications.info(`${sourceItem.name} added to sell list`);
  }

  onMount(() => {
    shopTelemetry('InventoryPlayerTab', 'mounted', {
      actorId: $Actor?.id,
      actorUuid: $Actor?.uuid,
      itemCount: $Actor?.items?.size,
      itemQuantities: itemQuantitySnapshot($Actor?.items),
    });

    unsubscribeActor = Actor.subscribe((actor, options) => {
      shopTelemetry('InventoryPlayerTab', 'Actor store emitted', {
        action: options?.action,
        data: options?.data,
        actorId: actor?.id,
        actorUuid: actor?.uuid,
        itemCount: actor?.items?.size,
        itemQuantities: itemQuantitySnapshot(actor?.items),
        basketActorIds: Object.keys(actor?.flags?.[MODULE_ID]?.basket ?? {}),
        targetBasket: targetActorId ? (actor?.flags?.[MODULE_ID]?.basket?.[targetActorId] ?? []) : [],
      });
    });

    unsubscribeWildcard = wildcard.subscribe((value) => {
      shopTelemetry('InventoryPlayerTab', 'wildcard emitted', {
        shopUuid,
        socketStockRevision,
        itemCount: value?.size ?? value?.length,
        itemQuantities: itemQuantitySnapshot(value),
      });
    });
  });

  onDestroy(() => {
    unsubscribeActor();
    unsubscribeWildcard();
  });

  $: if (typeFilterValue === "all") {
    typeSearch.set("");
  } else {
    typeSearch.set([typeFilterValue]);
  }

  $: {
    $Actor;
    $wildcard;
    $nameSearch;
    $typeSearch;
    sortKey;
    sortDir;
    socketStockRevision;
    items = getInventoryItems();
    shopTelemetry('InventoryPlayerTab', 'items reassigned', {
      shopUuid,
      socketStockRevision,
      itemCount: items.length,
      itemQuantities: itemQuantitySnapshot(items),
      socketStock: [...(socketShopState?.stockByItemId ?? new Map()).entries()],
    });
  }
</script>

<template lang="pug">

    .panel.overflow.containerx
      .flexrow.pt-sm.pr-sm.pl-sm.justify-flexrow-vertical.gap-10
        .flexcol.flex1.label-container
          label {localize('Search')}
        .flex3.left
          TJSInput({input})
        .flexcol.flex1.label-container
          label {localize('Type')}
        .flex3.right
          select.short(value="{typeFilterValue}" on:change!="{onTypeFilterChange}")
            +each("typeFilterOptions as opt")
              option(value="{opt.value}") {opt.label}
      .padded
        h1.gold {localize('Inventory')}
        .inv-table
          .inv-header
            .inv-col-icon
            .inv-col-name.sortable(data-key="name" on:click!="{onSortClick}" class:active="{sortKey === 'name'}")
              span {localize('Name')}
              i.fa.sort-indicator(class!="{sortKey === 'name' ? (sortDir === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc') : 'fa-sort'}")
            .inv-col-price.sortable(data-key="price" on:click!="{onSortClick}" class:active="{sortKey === 'price'}")
              span {localize('Price')}
              i.fa.sort-indicator(class!="{sortKey === 'price' ? (sortDir === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc') : 'fa-sort'}")
            .inv-col-qty.sortable(data-key="system.quantity" on:click!="{onSortClick}" class:active="{sortKey === 'system.quantity'}")
              span {localize('Quantity')}
              i.fa.sort-indicator(class!="{sortKey === 'system.quantity' ? (sortDir === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc') : 'fa-sort'}")
            .inv-col-actions
          +each("items as item, index")
            .inv-row
              .inv-col-icon(data-tooltip="{localize('View')}" data-index="{index}" on:click!="{onShowItemClick}" role="button")
                img.icon(src="{item.img}" alt="{item.name}")
              .inv-col-name(data-tooltip="{localize('View')}")
                a.stealth.link(data-index="{index}" on:click!="{onShowItemClick}" class!="{item.system.isMagic ? 'pulse' : ''}" role="button") {item.name}
              .inv-col-price
                span.price-text {formatPrice(item)}
              .inv-col-qty
                span.qty-value {getDisplayQuantity(item)}
              .inv-col-actions
                button.stealth.basket-btn(disabled="{isOutOfStock(item)}" data-tooltip="Add to basket" data-index="{index}" on:click!="{onAddToBasketClick}")
                  i.fa.fa-shopping-basket
            
        .sell-zone
          h2.gold {localize('SellZone')}
          p.sell-zone__hint {localize('SellZoneHint')}
          DropZone(placeholder="{localize('SellZone')}" acceptType="Item" onDrop!="{handleSellDrop}")
            
</template>

<style lang="sass">
@use "../../../styles/Mixins.sass" as mixins

.containerx
  container-type: inline-size

.padded
  transition: padding 0.2s ease-in-out
  @container (min-width: 350px)
    padding: 1rem

.pulse
  +mixins.pulse

// ── Inventory table (CSS grid for perfect alignment) ──
.inv-table
  display: flex
  flex-direction: column
  width: 100%

.inv-header
  display: grid
  grid-template-columns: 36px 1fr 90px 80px 50px
  gap: 4px
  align-items: center
  padding: 4px 4px
  border-bottom: 2px solid var(--dnd5e-color-gold, #b59e54)
  color: var(--dnd5e-color-gold, #b59e54)
  font-weight: bold
  font-size: 0.85rem

  .sortable
    display: flex
    align-items: center
    gap: 4px
    cursor: pointer
    user-select: none

    &:hover
      color: #fff

    &.active
      color: #fff

    .sort-indicator
      font-size: 0.75rem
      opacity: 0.6

      &.fa-sort
        opacity: 0.3

.inv-row
  display: grid
  grid-template-columns: 36px 1fr 90px 80px 50px
  gap: 4px
  align-items: center
  padding: 2px 4px
  border-bottom: 1px solid rgba(255, 255, 255, 0.08)
  min-height: 36px

  &:hover
    background: rgba(255, 255, 255, 0.04)

.inv-col-icon
  display: flex
  align-items: center
  justify-content: center

  img.icon
    width: 28px
    height: 28px
    object-fit: cover
    border-radius: 3px
    cursor: pointer

.inv-col-name
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
  font-size: 0.85rem

.inv-col-price
  text-align: center
  font-size: 0.8rem
  color: var(--gas-color-text)

  .price-text
    white-space: nowrap

.inv-col-qty
  display: flex
  justify-content: center

.inv-col-actions
  display: flex
  justify-content: center
  gap: 2px

.qty-value
  min-width: 24px
  text-align: center
  font-size: 0.85rem
  font-weight: 500

.basket-btn
  width: 28px
  height: 28px
  padding: 0
  display: flex
  align-items: center
  justify-content: center
  font-size: 0.85rem
  border-radius: 3px
  color: var(--dnd5e-color-gold, #b59e54)

  &:hover
    background: rgba(255, 255, 255, 0.15)
    color: #fff

// ── Sell zone ──
.sell-zone
  margin-top: 1rem
  padding-top: 0.75rem
  border-top: 1px solid rgba(255, 255, 255, 0.08)

  h2.gold
    font-size: 1rem
    margin: 0 0 0.25rem

  .sell-zone__hint
    margin: 0 0 0.5rem
    font-size: 0.8rem
    opacity: 0.6
</style>
