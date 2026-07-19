<script>
  import { getContext, onDestroy, onMount } from "svelte";
  import { localize } from "~/src/helpers/utility";
  import { MODULE_ID } from "~/src/helpers/constants";
  import {
    formatPrice as formatCurrencyPrice,
    formatTotalPrice,
    getActorCurrencyPaymentUpdate,
    getBuyPrice,
    getComparablePriceValue,
    makeBasketPrice,
    multiplyPrice,
    sumPrices,
  } from "~/src/helpers/currency.js";
  import { requestBasketUpdate, requestPurchase, requestSell } from "~/src/helpers/shopSocket.js";
  import { shopSocketState } from "~/src/stores/basketState.js";
  import { shopTelemetry } from "~/src/helpers/telemetry.js";
  import { createSortQuery } from "~/src/filters/itemFilterQuery";
  import DropZone from "~/src/components/molecules/DropZone.svelte";
  import {
    getCurrentTokenTargetEntries,
    getShopTargetEntries,
    resolveShopTargetActor,
  } from "~/src/helpers/shopTargets.js";

  const doc = getContext("#doc");

  export let sharedProps = {};

  $: targetActorId = sharedProps.targetActorId ?? null;
  $: selectedActor = targetActorId ? resolveShopTargetActor($doc, targetActorId) : null;
  $: shopUuid = $doc?.uuid ?? ($doc?.id ? `Actor.${$doc.id}` : null);
  $: socketShopState = shopUuid ? $shopSocketState.get(shopUuid) : null;
  let tokenTargetRevision = 0;

  /** Actor options for the target select. */
  $: actorOptions = (() => {
    if (game.user.isGM) {
      tokenTargetRevision;
      const targetEntries = [
        ...getShopTargetEntries($doc),
        ...getCurrentTokenTargetEntries({ excludeActorId: $doc?.id, source: 'gm-token-target' }),
      ];
      return [...new Map(targetEntries.map((entry) => [entry.actorId, entry])).values()]
        .filter((entry) => entry?.actorId)
        .filter(Boolean)
        .map((entry) => ({
          id: entry.actorId,
          actorUuid: entry.actorUuid,
          tokenUuid: entry.tokenUuid,
          name: entry.name,
          img: entry.img,
        }));
    } else {
      return game.actors
        .filter(a => a.isOwner)
        .map(a => ({ id: a.id, actorUuid: a.uuid, name: a.name, img: a.img }));
    }
  })();

  let dropdownOpen = false;
  let unsubscribeDoc = () => {};
  let targetTokenHookId = null;

  const sortQuery = createSortQuery({
    defaultKey: "itemName",
    defaultDirection: "asc",
    resolvers: { price: (entry) => getComparablePriceValue(entry?.price) },
  });

  function onSortClick(e) {
    const key = e.currentTarget.dataset.key;
    shopTelemetry('BasketTab', 'sort header clicked', {
      key,
      previousSortKey: sortKey,
      previousSortDir: sortDir,
    });
    sortQuery.toggle(key);
    sortKey = sortQuery.getKey();
    sortDir = sortQuery.getDirection();
    shopTelemetry('BasketTab', 'sort header applied', {
      key,
      nextSortKey: sortKey,
      nextSortDir: sortDir,
      basketCount: basket.length,
    });
  }

  let sortKey = sortQuery.getKey();
  let sortDir = sortQuery.getDirection();

  /** Return a sorted copy of the given basket entries using the active sort query. */
  function sortBasket(entries) {
    return [...entries].sort(sortQuery);
  }

  function selectActor(id) {
    const targetEntry = actorOptions.find((option) => option.id === id);
    shopTelemetry('BasketTab', 'select actor', {
      previousTargetActorId: targetActorId,
      nextTargetActorId: id,
      shopId: $doc?.id,
      shopUuid,
      targetEntry,
    });
    dropdownOpen = false;
    sharedProps.onTargetActorChange?.(id ?? null, targetEntry);
  }

  function closeDropdown() {
    dropdownOpen = false;
  }

  let basket = [];
  $: totalPrice = basket.length ? getBasketTotal(basket) : "—";

  function getBasketTotal(entries) {
    return formatTotalPrice(entries.map((entry) => ({
      price: entry.price,
      quantity: entry.quantity ?? 1,
    })));
  }

  function getBasketTotalPrice(entries) {
    return sumPrices(entries.map((entry) => ({
      price: entry.price,
      quantity: entry.quantity ?? 1,
    })));
  }

  $: userId = game.user.id;

  /** Load basket from shop actor flags whenever doc or targetActorId changes. */
  $: {
    sortKey;
    sortDir;
    if ($doc && targetActorId) {
      const documentBasket = $doc?.flags?.[MODULE_ID]?.basket?.[targetActorId] ?? [];
      const hasSocketBasket = socketShopState?.basketsByActorId?.has(targetActorId) ?? false;
      const socketBasket = socketShopState?.basketsByActorId?.get(targetActorId) ?? [];
      const sourceBasket = hasSocketBasket ? socketBasket : documentBasket;
      basket = sourceBasket.map((entry) => ({ ...entry })).sort(sortQuery);
      shopTelemetry('BasketTab', 'basket derived', {
        shopId: $doc?.id,
        shopUuid,
        targetActorId,
        selectedActorName: selectedActor?.name,
        source: hasSocketBasket ? 'socket' : 'document',
        documentBasketLength: documentBasket.length,
        socketBasketLength: socketBasket.length,
        resultBasketLength: basket.length,
        documentBasket,
        socketBasket,
        basketActorIds: Object.keys($doc?.flags?.[MODULE_ID]?.basket ?? {}),
        socketBasketActorIds: [...(socketShopState?.basketsByActorId?.keys?.() ?? [])],
        shopTargetActorIds: getShopTargetEntries($doc).map((entry) => entry.actorId),
        currentTokenTargetActorIds: getCurrentTokenTargetEntries({ excludeActorId: $doc?.id }).map((entry) => entry.actorId),
        associatedActors: sharedProps.associatedActors ?? [],
        actorOptions,
        isGM: game.user.isGM,
      });
    } else {
      basket = [];
      shopTelemetry('BasketTab', 'basket derived empty: missing doc or target', {
        hasDoc: Boolean($doc),
        shopId: $doc?.id,
        shopUuid,
        targetActorId,
        basketActorIds: Object.keys($doc?.flags?.[MODULE_ID]?.basket ?? {}),
        socketBasketActorIds: [...(socketShopState?.basketsByActorId?.keys?.() ?? [])],
        shopTargetActorIds: getShopTargetEntries($doc).map((entry) => entry.actorId),
        currentTokenTargetActorIds: getCurrentTokenTargetEntries({ excludeActorId: $doc?.id }).map((entry) => entry.actorId),
        associatedActors: sharedProps.associatedActors ?? [],
        actorOptions,
        isGM: game.user.isGM,
      });
    }
  }

  /** Track basket changes for debugging */
  $: {
    if ($doc && basket.length > 0) {
      window.GAS.log.p('BasketTab | basket has items:', basket.length, '| first item:', basket[0].itemName);
    }
    if ($doc && basket.length === 0) {
      window.GAS.log.p('BasketTab | basket is empty');
    }
  }

  function removeFromBasket(index) {
    const removedItem = basket[index];
    window.GAS.log.p('removeFromBasket | removing item:', removedItem?.itemName, '| index:', index, '| basket length before:', basket.length);
    basket = basket.filter((_, i) => i !== index);
    window.GAS.log.p('removeFromBasket | basket length after:', basket.length);
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
    const oldQty = basket[index].quantity ?? 1;
    const newQty = oldQty + delta;
    window.GAS.log.p('changeQuantity | changing qty for item:', basket[index].itemName, '| index:', index, '| old qty:', oldQty, '| delta:', delta, '| new qty:', newQty);

    if (newQty <= 0) {
      removeFromBasket(index);
      return;
    }
    basket = sortBasket(basket.map((entry, i) => (
      i === index ? { ...entry, quantity: newQty } : { ...entry }
    )));
    window.GAS.log.p('changeQuantity | updated basket length:', basket.length);
    persistBasket();
  }

  async function persistBasket() {
    if (!targetActorId) return;
    const nextBasket = basket.map((entry) => ({ ...entry }));
    shopTelemetry('BasketTab', 'persistBasket start', {
      shopId: $doc?.id,
      shopUuid,
      targetActorId,
      nextBasket,
      isGM: game.user.isGM,
    });

    const result = await requestBasketUpdate({
      shopId: $doc.id,
      shopUuid: $doc.uuid,
      targetActorId,
      nextBasket,
    });
    shopTelemetry('BasketTab', 'persistBasket socket result', {
      shopId: $doc?.id,
      shopUuid,
      targetActorId,
      result,
    });
    if (!result.success) {
      (result.errors ?? []).forEach((err) => ui.notifications.warn(err));
      return;
    }
    basket = sortBasket(result.basket ?? nextBasket);
  }

  async function clearBasket() {
    if (!targetActorId) return;
    shopTelemetry('BasketTab', 'clearBasket start', {
      shopId: $doc?.id,
      shopUuid,
      targetActorId,
      currentBasket: basket,
      isGM: game.user.isGM,
    });
    basket = [];

    const result = await requestBasketUpdate({
      shopId: $doc.id,
      shopUuid: $doc.uuid,
      targetActorId,
      nextBasket: [],
    });
    shopTelemetry('BasketTab', 'clearBasket socket result', {
      shopId: $doc?.id,
      shopUuid,
      targetActorId,
      result,
    });
    if (!result.success) {
      (result.errors ?? []).forEach((err) => ui.notifications.warn(err));
    }
  }

  async function onBuyNow() {
    window.GAS.log.p('onBuyNow | attempting purchase for shop:', $doc?.name, '| basket length:', basket.length, '| targetActorId:', targetActorId);

    if (!targetActorId) {
      ui.notifications.warn(localize('NoTargetActor'));
      return;
    }
    if (basket.length === 0) {
      window.GAS.log.p('onBuyNow | basket is empty, nothing to purchase');
      return;
    }

    const targetActor = resolveShopTargetActor($doc, targetActorId);
    if (!targetActor || (!targetActor.isOwner && !game.user.isGM)) {
      ui.notifications.warn(localize('NoTargetActor'));
      return;
    }

    const payment = getActorCurrencyPaymentUpdate(targetActor, getBasketTotalPrice(basket));
    if (!payment.success) {
      payment.errors.forEach(err => ui.notifications.warn(err));
      return;
    }

    window.GAS.log.p('onBuyNow | requesting purchase via socket');
    const result = await requestPurchase({
      shopId: $doc.id,
      shopUuid: $doc.uuid,
      targetActorId,
      basket: basket.map((entry) => serializeBasketEntry(entry)),
    });

    window.GAS.log.p('onBuyNow | socket purchase result:', result.success, '| errors:', result.errors?.length || 0);
    if (result.errors?.length) {
      result.errors.forEach(err => ui.notifications.warn(err));
    } else {
      window.GAS.log.p('onBuyNow | purchase successful, clearing local basket state');
      basket = [];
      ui.notifications.info(game.i18n.format('PurchaseComplete', { actorName: targetActor.name }));
    }
  }

  async function onSellNow() {
    window.GAS.log.p('onSellNow | attempting sell for shop:', $doc?.name, '| basket length:', basket.length, '| targetActorId:', targetActorId);

    if (!targetActorId) {
      ui.notifications.warn(localize('NoTargetActor'));
      return;
    }

    const sellEntries = basket.filter((entry) => entry.direction === 'sell');
    if (sellEntries.length === 0) {
      window.GAS.log.p('onSellNow | no sell entries');
      return;
    }

    const targetActor = resolveShopTargetActor($doc, targetActorId);
    if (!targetActor || (!targetActor.isOwner && !game.user.isGM)) {
      ui.notifications.warn(localize('NoTargetActor'));
      return;
    }

    window.GAS.log.p('onSellNow | requesting sell via socket');
    const result = await requestSell({
      shopId: $doc.id,
      shopUuid: $doc.uuid,
      targetActorId,
      basket: sellEntries.map((entry) => serializeSellEntry(entry)),
    });

    window.GAS.log.p('onSellNow | socket sell result:', result.success, '| errors:', result.errors?.length || 0);
    if (result.errors?.length) {
      result.errors.forEach(err => ui.notifications.warn(err));
    } else {
      window.GAS.log.p('onSellNow | sell successful, removing sell entries from local basket');
      basket = basket.filter((entry) => entry.direction !== 'sell');
      ui.notifications.info(localize('SellComplete'));
    }
  }

  function serializeSellEntry(entry) {
    return {
      itemId: entry.itemId,
      itemName: entry.itemName,
      quantity: entry.quantity ?? 1,
      price: makeBasketPrice(entry.price),
      direction: 'sell',
      sourceActorId: entry.sourceActorId ?? targetActorId,
    };
  }

  /** Resolve a dropped item into a sell basket entry for the selected target actor. */
  async function handleSellDrop(data) {
    shopTelemetry('BasketTab', 'sell drop received', {
      shopId: $doc?.id,
      shopUuid,
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

    const currentBasket = targetActorId ? ($doc?.flags?.[MODULE_ID]?.basket?.[targetActorId] ?? []) : [];
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
      shopId: $doc.id,
      shopUuid: $doc.uuid,
      targetActorId,
      nextBasket,
    });
    shopTelemetry('BasketTab', 'sell drop basket update result', {
      shopId: $doc?.id,
      targetActorId,
      result,
    });
    if (!result.success) {
      (result.errors ?? []).forEach((err) => ui.notifications.warn(err));
      return;
    }
    ui.notifications.info(`${sourceItem.name} added to sell list`);
  }

  function formatPrice(price) {
    return formatCurrencyPrice(price);
  }

  function formatLineTotal(entry) {
    return formatPrice(multiplyPrice(entry.price, entry.quantity ?? 1));
  }

  function formatTotal() {
    return totalPrice;
  }

  function serializeBasketEntry(entry) {
    return {
      itemId: entry.itemId,
      itemName: entry.itemName,
      quantity: entry.quantity ?? 1,
      price: makeBasketPrice(entry.price),
    };
  }

  function showItemSheet(itemId) {
    const item = $doc.items.get(itemId);
    if (item) item.sheet.render(true);
  }

  onMount(() => {
    shopTelemetry('BasketTab', 'mounted', {
      shopId: $doc?.id,
      shopUuid,
      targetActorId,
      basketActorIds: Object.keys($doc?.flags?.[MODULE_ID]?.basket ?? {}),
      shopTargetActorIds: getShopTargetEntries($doc).map((entry) => entry.actorId),
      currentTokenTargetActorIds: getCurrentTokenTargetEntries({ excludeActorId: $doc?.id }).map((entry) => entry.actorId),
      associatedActors: sharedProps.associatedActors ?? [],
      actorOptions,
    });

    if (game.user.isGM) {
      targetTokenHookId = Hooks.on('targetToken', (user) => {
        if (user?.id !== game.user.id) return;
        tokenTargetRevision += 1;
        shopTelemetry('BasketTab', 'targetToken hook', {
          shopId: $doc?.id,
          shopUuid,
          tokenTargetRevision,
          currentTokenTargetActorIds: getCurrentTokenTargetEntries({ excludeActorId: $doc?.id }).map((entry) => entry.actorId),
        });
      });
    }

    unsubscribeDoc = doc.subscribe((document, options) => {
      shopTelemetry('BasketTab', 'doc store emitted', {
        action: options?.action,
        data: options?.data,
        shopId: document?.id,
        shopUuid: document?.uuid,
        targetActorId,
        basketActorIds: Object.keys(document?.flags?.[MODULE_ID]?.basket ?? {}),
        shopTargetActorIds: getShopTargetEntries(document).map((entry) => entry.actorId),
        targetBasket: targetActorId ? (document?.flags?.[MODULE_ID]?.basket?.[targetActorId] ?? []) : [],
      });
    });
  });

  onDestroy(() => {
    unsubscribeDoc();
    if (targetTokenHookId !== null) Hooks.off('targetToken', targetTokenHookId);
  });
</script>

<svelte:window on:click="{closeDropdown}" />
<template lang="pug">
  .panel.overflow.containerx
    .padded
      h1.gold {localize('Basket')}
      .actor-select-faux(on:click!='{e => e.stopPropagation()}')
        button.actor-trigger(type="button" on:click!="{() => dropdownOpen = !dropdownOpen}")
          +if("selectedActor")
            img.actor-avatar(src="{selectedActor.img || 'icons/svg/mystery-man.svg'}" alt="{selectedActor.name}")
            span.actor-name {selectedActor.name}
            +else()
              i.fa.fa-user-circle.actor-placeholder-icon
              span.actor-name.placeholder — {localize('BasketSelectActor')} —
          i.fa.fa-chevron-down.chevron(class:open="{dropdownOpen}")
        +if("dropdownOpen")
          .actor-dropdown
            +if("actorOptions.length === 0")
              .actor-option.empty {localize('ShopHUD.NoActorOwned')}
              +else()
                +each("actorOptions as opt")
                  button.actor-option(type="button" class:selected="{opt.id === targetActorId}" on:click!="{() => selectActor(opt.id)}")
                    img.actor-avatar(src="{opt.img || 'icons/svg/mystery-man.svg'}" alt="{opt.name}")
                    span {opt.name}
      +if("basket.length === 0")
        .empty-basket
          i.fa.fa-shopping-basket.empty-icon
          p {localize('BasketEmpty') || 'Your basket is empty. Browse the inventory to add items.'}
        .sell-zone
          h2.gold {localize('SellZone')}
          p.sell-zone__hint {localize('SellZoneHint')}
          DropZone(placeholder="{localize('SellZone')}" acceptType="Item" onDrop!="{handleSellDrop}")
        +else()
          .basket-table
            .basket-header
              .basket-col-icon
              .basket-col-name.sortable(data-key="itemName" on:click!="{onSortClick}" class:active="{sortKey === 'itemName'}")
                span {localize('Name')}
                i.fa.sort-indicator(class!="{sortKey === 'itemName' ? (sortDir === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc') : 'fa-sort'}")
              .basket-col-price.sortable(data-key="price" on:click!="{onSortClick}" class:active="{sortKey === 'price'}")
                span {localize('Price')}
                i.fa.sort-indicator(class!="{sortKey === 'price' ? (sortDir === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc') : 'fa-sort'}")
              .basket-col-qty.sortable(data-key="quantity" on:click!="{onSortClick}" class:active="{sortKey === 'quantity'}")
                span {localize('Quantity')}
                i.fa.sort-indicator(class!="{sortKey === 'quantity' ? (sortDir === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc') : 'fa-sort'}")
              .basket-col-total {localize('Total')}
              .basket-col-actions
            +each("basket as entry, index")
              .basket-row(class!="{entry.direction === 'sell' ? 'sell-row' : 'buy-row'}")
                .basket-col-icon(data-tooltip="{localize('View')}" data-item-id="{entry.itemId}" on:click!="{onShowItemClick}" role="button")
                  img.icon(src="{entry.img || 'icons/svg/mystery-man.svg'}" alt="{entry.itemName}")
                .basket-col-name(data-tooltip="{localize('View')}")
                  a.stealth.link(data-item-id="{entry.itemId}" on:click!="{onShowItemClick}" role="button") {entry.itemName}
                  +if("entry.direction === 'sell'")
                    span.sell-tag {localize('Sell')}
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
                  span.total-text {formatLineTotal(entry)}
                .basket-col-actions
                  button.stealth.negative(data-tooltip="Remove" data-index="{index}" on:click!="{onRemoveClick}")
                    i.fa.fa-trash
          .basket-footer
            .basket-total-label {localize('Total')}:
            .basket-total-value {formatTotal()}
            button.glossy-button.gold-light.hover-shine(on:click!="{clearBasket}") {localize('ClearBasket') || 'Clear Basket'}
            +if("targetActorId")
              +if("basket.some(e => e.direction === 'sell')")
                button.glossy-button.sell.hover-shine.sell-now-btn(on:click!="{onSellNow}") {localize('SellNow') || 'Sell Now'}
              button.glossy-button.primary.hover-shine.buy-now-btn(on:click!="{onBuyNow}") {localize('BuyNow') || 'Buy Now'}
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

// ── Faux actor select ──
.actor-select-faux
  position: relative
  width: 100%
  margin-bottom: 0.75rem

.actor-trigger
  display: flex
  align-items: center
  gap: 0.5rem
  width: 100%
  padding: 6px 10px
  background: var(--gas-input-background, rgba(0,0,0,0.35))
  border: 1px solid var(--gas-tab-inactive-border, rgba(255,255,255,0.2))
  border-radius: var(--border-radius, 3px)
  color: var(--gas-color-text)
  cursor: pointer
  text-align: left

  &:hover
    border-color: var(--dnd5e-color-gold, #b59e54)

  .actor-avatar
    width: 28px
    height: 28px
    border-radius: 50%
    object-fit: cover
    flex-shrink: 0
    border: 1px solid rgba(255,255,255,0.15)

  .actor-placeholder-icon
    width: 28px
    height: 28px
    font-size: 1.4rem
    display: flex
    align-items: center
    justify-content: center
    color: rgba(255,255,255,0.35)
    flex-shrink: 0

  .actor-name
    flex: 1
    font-size: 0.9rem
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

    &.placeholder
      opacity: 0.5
      font-style: italic

  .chevron
    font-size: 0.75rem
    opacity: 0.6
    transition: transform 0.15s ease
    flex-shrink: 0

    &.open
      transform: rotate(180deg)

.actor-dropdown
  position: absolute
  top: calc(100% + 2px)
  left: 0
  right: 0
  z-index: 100
  background: var(--gas-tabs-content-background, #1a1a2e)
  border: 1px solid var(--dnd5e-color-gold, #b59e54)
  border-radius: var(--border-radius, 3px)
  box-shadow: 0 4px 12px rgba(0,0,0,0.5)
  overflow: hidden

.actor-option
  display: flex
  align-items: center
  gap: 0.5rem
  width: 100%
  padding: 6px 10px
  background: transparent
  border: none
  color: var(--gas-color-text)
  cursor: pointer
  text-align: left
  font-size: 0.9rem

  &:hover
    background: rgba(255,255,255,0.08)

  &.selected
    background: rgba(181,158,84,0.15)
    color: var(--dnd5e-color-gold, #b59e54)

  &.empty
    opacity: 0.5
    font-style: italic
    cursor: default

    &:hover
      background: transparent

  .actor-avatar
    width: 26px
    height: 26px
    border-radius: 50%
    object-fit: cover
    flex-shrink: 0
    border: 1px solid rgba(255,255,255,0.15)

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

// ── Sell row distinction ──
.sell-row
  background: color-mix(in srgb, var(--gas-tab-active-indicator, #b3341a) 8%, transparent)

  &:hover
    background: color-mix(in srgb, var(--gas-tab-active-indicator, #b3341a) 14%, transparent)

.sell-tag
  display: inline-block
  margin-left: 0.4rem
  padding: 0 0.35rem
  font-size: 0.65rem
  font-weight: bold
  text-transform: uppercase
  letter-spacing: 0.04em
  color: #fff
  background: var(--gas-tab-active-indicator, #b3341a)
  border-radius: 3px
  vertical-align: middle

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

.buy-now-btn
  margin-left: 0.5rem
  background: var(--dnd5e-color-gold, #b59e54)
  color: #1a1a1a
  font-weight: bold
  padding: 0.4rem 1rem

  &:hover
    filter: brightness(1.2)

.sell-now-btn
  margin-left: 0.5rem
  background: var(--gas-tab-active-indicator, #b3341a)
  color: #fff
  font-weight: bold
  padding: 0.4rem 1rem

  &:hover
    filter: brightness(1.2)

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
