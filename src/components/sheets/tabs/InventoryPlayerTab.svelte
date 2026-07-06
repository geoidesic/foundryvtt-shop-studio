<script>
  import { getContext, onMount } from "svelte";
  import { rippleFocus } from "#standard/action/animate/composable";
  import { TJSDocument } from "#runtime/svelte/store/fvtt/document";

  import { TJSInput } from "#standard/component/form";
  import { createFilterQuery } from "~/src/filters/itemFilterQuery";
  import { localize } from "~/src/helpers/utility";
  import { MODULE_ID } from "~/src/helpers/constants";
  import { getConfiguredListableItemTypes } from "~/src/helpers/itemSources";

  const Actor = getContext("#doc");
  const doc = new TJSDocument($Actor);

  export let sharedProps = {};

  $: targetActorId = sharedProps.targetActorId ?? null;
  const typeSearch = createFilterQuery("type");
  const nameSearch = createFilterQuery("name");

  const input = {
    store: nameSearch,
    efx: rippleFocus(),
    placeholder: "by Name",
    type: "search",
    id: "search",
  };

  let typeFilterValue = "all";

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
    addToBasket(items[idx]);
  }

  function onTypeFilterChange(e) {
    typeFilterValue = e.target.value;
  }

  /** Format a price value for display. */
  function formatPrice(item) {
    const price = item?.system?.price;
    if (!price) return "—";
    if (typeof price === "object" && price.value !== undefined) {
      const gp = Math.floor(price.value);
      const sp = Math.floor((price.value - gp) * 10);
      const cp = Math.round(((price.value - gp) * 10 - sp) * 10);
      const parts = [];
      if (gp > 0) parts.push(`${gp} gp`);
      if (sp > 0) parts.push(`${sp} sp`);
      if (cp > 0) parts.push(`${cp} cp`);
      return parts.length > 0 ? parts.join(" ") : "—";
    }
    if (typeof price === "number") return `${price} gp`;
    return "—";
  }

  /** Add item to the player's basket (stored in a flag on the current user). */
  async function addToBasket(item) {
    if (!targetActorId) {
      ui.notifications.warn(localize('NoTargetActor'));
      return;
    }

    const shopId = $Actor.id;
    const basket = game.user.getFlag(MODULE_ID, `basket.${shopId}`) ?? [];
    const existing = basket.find((entry) => entry.itemId === item.id);
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + 1;
    } else {
      basket.push({
        itemId: item.id,
        itemName: item.name,
        img: item.img,
        price: item.system?.price?.value ?? item.system?.price ?? 0,
        quantity: 1,
      });
    }
    await game.user.setFlag(MODULE_ID, `basket.${shopId}`, basket);
    ui.notifications.info(`${item.name} added to basket`);
  }

  $: if (typeFilterValue === "all") {
    typeSearch.set("");
  } else {
    typeSearch.set([typeFilterValue]);
  }

  $: items = [...$wildcard];
</script>

<template lang="pug">

    .panel.overflow.containerx
      .flexrow.pt-sm.pr-sm.pl-sm
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
            .inv-col-name {localize('Name')}
            .inv-col-price {localize('Price')}
            .inv-col-qty {localize('Quantity')}
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
                span.qty-value {item.system.quantity ?? 0}
              .inv-col-actions
                button.stealth.basket-btn(data-tooltip="Add to basket" data-index="{index}" on:click!="{onAddToBasketClick}")
                  i.fa.fa-shopping-basket
            
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
</style>