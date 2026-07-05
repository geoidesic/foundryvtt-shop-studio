<script>
  import { getContext } from "svelte";
  import { localize } from "~/src/helpers/utility";
  import { MODULE_ID } from "~/src/helpers/constants";

  const doc = getContext("#doc");

  let basket = [];
  let totalPrice = 0;

  $: userId = game.user.id;

  /** Load basket from flags whenever the doc changes. */
  $: {
    if ($doc) {
      basket = $doc.getFlag(MODULE_ID, `basket.${userId}`) ?? [];
      totalPrice = basket.reduce((sum, entry) => sum + (entry.price ?? 0) * (entry.quantity ?? 1), 0);
    }
  }

  function removeFromBasket(index) {
    basket = basket.filter((_, i) => i !== index);
    persistBasket();
  }

  function onQtyClick(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    const delta = parseInt(e.currentTarget.dataset.delta);
    changeQuantity(idx, delta);
  }

  function onRemoveClick(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    removeFromBasket(idx);
  }

  function onShowItemClick(e) {
    const itemId = e.currentTarget.dataset.itemId;
    showItemSheet(itemId);
  }

  function changeQuantity(index, delta) {
    const newQty = (basket[index].quantity ?? 1) + delta;
    if (newQty <= 0) {
      removeFromBasket(index);
      return;
    }
    basket[index].quantity = newQty;
    basket = [...basket];
    persistBasket();
  }

  async function persistBasket() {
    await $doc.setFlag(MODULE_ID, `basket.${userId}`, basket);
    totalPrice = basket.reduce((sum, entry) => sum + (entry.price ?? 0) * (entry.quantity ?? 1), 0);
  }

  async function clearBasket() {
    basket = [];
    await $doc.setFlag(MODULE_ID, `basket.${userId}`, []);
    totalPrice = 0;
  }

  /** Format a price value for display. */
  function formatPrice(price) {
    if (!price && price !== 0) return "—";
    const gp = Math.floor(price);
    const sp = Math.floor((price - gp) * 10);
    const cp = Math.round(((price - gp) * 10 - sp) * 10);
    const parts = [];
    if (gp > 0) parts.push(`${gp} gp`);
    if (sp > 0) parts.push(`${sp} sp`);
    if (cp > 0) parts.push(`${cp} cp`);
    return parts.length > 0 ? parts.join(" ") : "—";
  }

  function formatTotal() {
    return formatPrice(totalPrice);
  }

  function showItemSheet(itemId) {
    const item = $doc.items.get(itemId);
    if (item) item.sheet.render(true);
  }
</script>

<template lang="pug">
  .panel.overflow.containerx
    .padded
      h1.gold {localize('Basket')}
      +if("basket.length === 0")
        .empty-basket
          i.fa.fa-shopping-basket.empty-icon
          p {localize('BasketEmpty') || 'Your basket is empty. Browse the inventory to add items.'}
        +else()
          .basket-table
            .basket-header
              .basket-col-icon
              .basket-col-name {localize('Name')}
              .basket-col-price {localize('Price')}
              .basket-col-qty {localize('Quantity')}
              .basket-col-total {localize('Total')}
              .basket-col-actions
            +each("basket as entry, index")
              .basket-row
                .basket-col-icon(data-tooltip="{localize('View')}" data-item-id="{entry.itemId}" on:click!="{onShowItemClick}" role="button")
                  img.icon(src="{entry.img || 'icons/svg/mystery-man.svg'}" alt="{entry.itemName}")
                .basket-col-name(data-tooltip="{localize('View')}")
                  a.stealth.link(data-item-id="{entry.itemId}" on:click!="{onShowItemClick}" role="button") {entry.itemName}
                .basket-col-price
                  span.price-text {formatPrice(entry.price)}
                .basket-col-qty
                  .qty-controls
                    button.stealth.qty-btn(data-tooltip="Decrease" data-index="{index}" data-delta="-1" on:click!="{onQtyClick}")
                      i.fa.fa-minus
                    span.qty-value {entry.quantity ?? 1}
                    button.stealth.qty-btn(data-tooltip="Increase" data-index="{index}" data-delta="1" on:click!="{onQtyClick}")
                      i.fa.fa-plus
                .basket-col-total
                  span.total-text {formatPrice((entry.price ?? 0) * (entry.quantity ?? 1))}
                .basket-col-actions
                  button.stealth.negative(data-tooltip="Remove" data-index="{index}" on:click!="{onRemoveClick}")
                    i.fa.fa-trash
          .basket-footer
            .basket-total-label {localize('Total')}:
            .basket-total-value {formatTotal()}
            button.glossy-button.gold-light.hover-shine(on:click!="{clearBasket}") {localize('ClearBasket') || 'Clear Basket'}
            
</template>

<style lang="sass">
@use "../../../styles/Mixins.sass" as mixins

.containerx
  container-type: inline-size

.padded
  transition: padding 0.2s ease-in-out
  @container (min-width: 350px)
    padding: 1rem

// ── Empty state ──
.empty-basket
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  padding: 2rem
  color: var(--gas-color-text)
  opacity: 0.6

  .empty-icon
    font-size: 3rem
    margin-bottom: 1rem
    color: var(--dnd5e-color-gold, #b59e54)

  p
    font-size: 0.95rem
    text-align: center

// ── Basket table ──
.basket-table
  display: flex
  flex-direction: column
  width: 100%

.basket-header
  display: grid
  grid-template-columns: 36px 1fr 80px 80px 80px 50px
  gap: 4px
  align-items: center
  padding: 4px 4px
  border-bottom: 2px solid var(--dnd5e-color-gold, #b59e54)
  color: var(--dnd5e-color-gold, #b59e54)
  font-weight: bold
  font-size: 0.8rem

.basket-row
  display: grid
  grid-template-columns: 36px 1fr 80px 80px 80px 50px
  gap: 4px
  align-items: center
  padding: 2px 4px
  border-bottom: 1px solid rgba(255, 255, 255, 0.08)
  min-height: 36px

  &:hover
    background: rgba(255, 255, 255, 0.04)

.basket-col-icon
  display: flex
  align-items: center
  justify-content: center

  img.icon
    width: 28px
    height: 28px
    object-fit: cover
    border-radius: 3px
    cursor: pointer

.basket-col-name
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
  font-size: 0.85rem

.basket-col-price,
.basket-col-total
  text-align: center
  font-size: 0.8rem
  color: var(--gas-color-text)

  .price-text,
  .total-text
    white-space: nowrap

.basket-col-qty
  display: flex
  justify-content: center

.basket-col-actions
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

// ── Footer ──
.basket-footer
  display: flex
  align-items: center
  justify-content: flex-end
  gap: 1rem
  padding: 0.75rem 0.5rem
  margin-top: 0.5rem
  border-top: 2px solid var(--dnd5e-color-gold, #b59e54)

.basket-total-label
  font-weight: bold
  color: var(--dnd5e-color-gold, #b59e54)
  font-size: 1rem

.basket-total-value
  font-size: 1.1rem
  font-weight: bold
  color: var(--gas-color-text)
  min-width: 80px
  text-align: right
</style>