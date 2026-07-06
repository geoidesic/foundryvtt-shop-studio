<svelte:options accessors={true} />

<script>
  import { setContext, onDestroy } from 'svelte';
  import Tabs from '~/src/components/molecules/Tabs.svelte';
  import ShopfrontPlayerTab from '~/src/components/sheets/tabs/ShopfrontPlayerTab.svelte';
  import InventoryPlayerTab from '~/src/components/sheets/tabs/InventoryPlayerTab.svelte';
  import BasketTab from '~/src/components/sheets/tabs/BasketTab.svelte';
  import { localize } from '~/src/helpers/utility.js';
  import { MODULE_ID } from '~/src/helpers/constants.ts';

  export let documentStore;
  export let targetActorId = null;

  setContext('#doc', documentStore);

  let activeTab = 'shopfront';
  let filterText = '';
  let selectedActorId = null;
  let _shopIdRestored = null;
  let basketVersion = 0;

  function notifyBasketChanged() {
    basketVersion += 1;
  }

  function onUserUpdated(user, change) {
    if (user?.id !== game.user.id || !shopId) return;
    if (!change?.flags?.[MODULE_ID]?.basket) return;
    notifyBasketChanged();
  }

  Hooks.on('updateUser', onUserUpdated);

  $: actor = $documentStore;
  $: shopId = actor?.id ?? null;
  $: isEditing = actor?.system?.identity?.isEditing ?? false;

  /** Restore persisted selected actor once the shop actor is available. */
  $: if (shopId && shopId !== _shopIdRestored) {
    _shopIdRestored = shopId;
    selectedActorId = game.user.getFlag(MODULE_ID, `selectedActor.${shopId}`) ?? null;
  }

  /** Clear basket when the sheet is closed. */
  onDestroy(async () => {
    Hooks.off('updateUser', onUserUpdated);
    if (shopId) {
      await game.user.setFlag(MODULE_ID, `basket.${shopId}`, []);
    }
  });

  $: tabs = [
    { id: 'shopfront', label: localize('Shopfront'), component: ShopfrontPlayerTab },
    { id: 'inventory', label: localize('Inventory'), component: InventoryPlayerTab },
    { id: 'basket', label: localize('Basket'), component: BasketTab },
  ];

  $: tabProps = {
    actor,
    isEditing,
    filterText,
    items: actor?.items || [],
    targetActorId: selectedActorId,
    basketVersion,
    localize,
    clearFilter,
    onBasketUpdated: notifyBasketChanged,
    onFilterChange: (value) => {
      filterText = value;
    },
    onTargetActorChange: async (id) => {
      selectedActorId = id;
      if (shopId) {
        await game.user.setFlag(MODULE_ID, `selectedActor.${shopId}`, id ?? '');
      }
    },
    associatedActors: actor?.system?.configuration?.associatedActors ?? [],
    getActorName,
  };

  function clearFilter() {
    filterText = '';
  }

  function getActorName(id) {
    const a = game.actors.get(id);
    return a?.name || id || 'Unknown Actor';
  }

</script>

<template lang="pug">
  section.shop-sheet-player
    main.shop-sheet-player__body
      Tabs.gas-tabs(tabs="{tabs}" bind:activeTab="{activeTab}" sharedProps="{tabProps}")
</template>

<style lang="sass">
@import "../../styles/Mixins.sass"
:global(.foundryvtt-shop-studio)
  .shop-sheet-player
    display: flex
    flex-direction: column
    gap: 0
    min-height: 100%
    padding: 0
    color: var(--gas-color-text)

    &__body
      flex: 1
      min-height: 0

    :global(.description-section)
      background: color-mix(in srgb, var(--gas-tabs-content-background) 80%, transparent)
      border: 1px solid color-mix(in srgb, var(--gas-tab-inactive-border) 45%, transparent)
      border-radius: var(--border-radius)
      box-shadow: 0 0 0 1px var(--gas-li-inset) inset
      padding: var(--size-md)

    :global(.description-section)
      align-self: start
      min-height: 120px
      display: flex
      flex-direction: column

    :global(.description-section h2)
      flex-shrink: 0

    :global(h2),
    :global(h3)
      margin: 0 0 var(--size-sm)
      color: var(--gas-tab-active-color)
      border-bottom: 1px solid color-mix(in srgb, var(--gas-tab-active-indicator) 45%, transparent)
      padding-bottom: var(--size-xs)

    :global(.profile-img)
      width: 100%
      object-fit: cover
      border: 2px solid color-mix(in srgb, var(--gas-tab-active-indicator) 55%, transparent)
      border-radius: 6px
      display: block
      margin: 0 auto var(--size-sm)
      background: var(--gas-input-background)
</style>