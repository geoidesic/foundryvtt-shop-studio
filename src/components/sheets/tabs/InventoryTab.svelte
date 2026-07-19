<script>
  import { getContext, onDestroy, onMount } from "svelte";
  import { rippleFocus } from "#standard/action/animate/composable";
  import { TJSDocument } from "#runtime/svelte/store/fvtt/document";

  import { TJSInput } from "#standard/component/form";
  import { createFilterQuery, createSortQuery } from "~/src/filters/itemFilterQuery";
  import { getComparablePriceValue } from "~/src/helpers/currency.js";
  import { localize } from "~/src/helpers/utility";
  import { applyPriceFactor, formatPrice as formatCurrencyPrice } from "~/src/helpers/currency.js";
  import { getConfiguredListableItemTypes } from "~/src/helpers/itemSources";
  import ScrollingContainer from "~/src/helpers/svelte-components/ScrollingContainer.svelte";
  import { shopSocketState } from "~/src/stores/basketState.js";
  import { itemQuantitySnapshot, shopTelemetry } from "~/src/helpers/telemetry.js";

  const Actor = getContext("#doc");
  const doc = new TJSDocument($Actor);

  $: doc.set($Actor);

  export let sharedProps = {};

  const typeSearch = createFilterQuery("type");
  const nameSearch = createFilterQuery("name");
  const sortQuery = createSortQuery({
    defaultKey: "name",
    defaultDirection: "asc",
    resolvers: { price: (item) => getComparablePriceValue(item?.system?.price) },
  });
  $: shopUuid = $Actor?.uuid ?? ($Actor?.id ? `Actor.${$Actor.id}` : null);
  $: socketShopState = shopUuid ? $shopSocketState.get(shopUuid) : null;
  $: socketStockRevision = socketShopState?.revision ?? 0;

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

  onMount(() => {
    shopTelemetry('InventoryTab', 'mounted', {
      actorId: $Actor?.id,
      actorUuid: $Actor?.uuid,
      itemCount: $Actor?.items?.size,
      itemQuantities: itemQuantitySnapshot($Actor?.items),
    });

    unsubscribeActor = Actor.subscribe((actor, options) => {
      shopTelemetry('InventoryTab', 'Actor store emitted', {
        action: options?.action,
        data: options?.data,
        actorId: actor?.id,
        actorUuid: actor?.uuid,
        itemCount: actor?.items?.size,
        itemQuantities: itemQuantitySnapshot(actor?.items),
      });
    });

    unsubscribeWildcard = wildcard.subscribe((value) => {
      shopTelemetry('InventoryTab', 'wildcard emitted', {
        actorId: $Actor?.id,
        actorUuid: $Actor?.uuid,
        itemCount: value?.size ?? value?.length,
        itemQuantities: itemQuantitySnapshot(value),
      });
    });
  });

  /** @type {import('@typhonjs-fvtt/runtime/svelte/store').DynMapReducer<string, Item>} */
  const wildcard = doc.embedded.create(Item, {
    name: "wildcard",
    filters: [typeSearch, nameSearch],
    sort: (a, b) => a.name.localeCompare(b.name),
  });

  async function addQuantity(item) {
    const quantity = (item.system.quantity ?? 0) + 1;
    shopTelemetry('InventoryTab', 'addQuantity update start', {
      actorId: $Actor?.id,
      itemId: item?.id,
      itemName: item?.name,
      previousQuantity: Number(item?.system?.quantity ?? 0),
      nextQuantity: quantity,
    });
    const [result] = await $Actor.updateEmbeddedDocuments('Item', [{
      _id: item.id,
      'system.quantity': quantity,
    }]);
    shopTelemetry('InventoryTab', 'addQuantity update complete', {
      actorId: $Actor?.id,
      itemId: item?.id,
      itemName: item?.name,
      resultQuantity: Number(result?.system?.quantity ?? item?.system?.quantity ?? 0),
      itemQuantityAfter: Number(item?.system?.quantity ?? 0),
      itemQuantities: itemQuantitySnapshot($Actor?.items),
    });
  }

  async function removeQuantity(item) {
    const quantity = Math.max(0, (item.system.quantity ?? 0) - 1);
    shopTelemetry('InventoryTab', 'removeQuantity update start', {
      actorId: $Actor?.id,
      itemId: item?.id,
      itemName: item?.name,
      previousQuantity: Number(item?.system?.quantity ?? 0),
      nextQuantity: quantity,
    });
    const [result] = await $Actor.updateEmbeddedDocuments('Item', [{
      _id: item.id,
      'system.quantity': quantity,
    }]);
    shopTelemetry('InventoryTab', 'removeQuantity update complete', {
      actorId: $Actor?.id,
      itemId: item?.id,
      itemName: item?.name,
      resultQuantity: Number(result?.system?.quantity ?? item?.system?.quantity ?? 0),
      itemQuantityAfter: Number(item?.system?.quantity ?? 0),
      itemQuantities: itemQuantitySnapshot($Actor?.items),
    });
  }

  function onAddQtyClick(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    addQuantity(items[idx]);
  }

  function onRemoveQtyClick(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    removeQuantity(items[idx]);
  }

  function onDeleteClick(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    items[idx].delete();
  }

  function onShowItemClick(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    items[idx].sheet.render(true);
  }

  async function removeAllItems() {
    const okToDelete = confirm(localize("Types.Actor.Inventory.confirmDeleteAll"));
    if (okToDelete) {
      const itemIds = getActorItems().map((item) => item.id);
      if (itemIds.length > 0) {
        await $Actor.deleteEmbeddedDocuments('Item', itemIds);
      }
    }
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
    shopTelemetry('InventoryTab', 'sort header clicked', {
      key,
      previousSortKey: sortKey,
      previousSortDir: sortDir,
    });
    sortQuery.toggle(key);
    sortKey = sortQuery.getKey();
    sortDir = sortQuery.getDirection();
    shopTelemetry('InventoryTab', 'sort header applied', {
      key,
      nextSortKey: sortKey,
      nextSortDir: sortDir,
      itemCount: items.length,
    });
  }

  let sortKey = sortQuery.getKey();
  let sortDir = sortQuery.getDirection();

  function getDisplayQuantity(item) {
    const stock = Number(item?.system?.quantity ?? 0);
    shopTelemetry('InventoryTab', 'display quantity evaluated', {
      shopUuid,
      itemId: item?.id,
      itemName: item?.name,
      documentQuantity: Number(item?.system?.quantity ?? 0),
      result: Math.max(0, stock),
      socketStockRevision,
    });
    return Math.max(0, stock);
  }

  function formatPrice(item) {
    return formatCurrencyPrice(applyPriceFactor(item?.system?.price, sharedProps.salePriceFactor ?? 100));
  }

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
    shopTelemetry('InventoryTab', 'items reassigned', {
      actorId: $Actor?.id,
      actorUuid: $Actor?.uuid,
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
                .qty-controls
                  button.stealth.qty-btn(data-tooltip="Decrease quantity" data-index="{index}" on:click!="{onRemoveQtyClick}")
                    i.fa.fa-minus
                  span.qty-value {getDisplayQuantity(item)}
                  button.stealth.qty-btn(data-tooltip="Increase quantity" data-index="{index}" on:click!="{onAddQtyClick}")
                    i.fa.fa-plus
              .inv-col-actions
                button.stealth.negative(data-tooltip="{localize('Types.Actor.ActionButtons.Delete')}" data-index="{index}" on:click!="{onDeleteClick}")
                  i.fa.fa-trash
            
      button.mt-sm.glossy-button.gold-light.hover-shine(on:click!="{removeAllItems}") {localize("Instructions.RemoveAll")}
            
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
  grid-template-columns: 36px 1fr 90px 100px 50px
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
  grid-template-columns: 36px 1fr 90px 100px 50px
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

.qty-controls
  display: flex
  align-items: center
  gap: 2px

.qty-btn
  width: 20px
  height: 20px
  padding: 0
  display: flex
  align-items: center
  justify-content: center
  font-size: 0.65rem
  border-radius: 3px
  background: rgba(255, 255, 255, 0.1)

  &:hover
    background: rgba(255, 255, 255, 0.25)

.qty-value
  min-width: 24px
  text-align: center
  font-size: 0.85rem
  font-weight: 500
</style>
