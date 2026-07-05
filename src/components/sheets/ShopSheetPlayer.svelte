<svelte:options accessors={true} />

<script>
  import { setContext } from 'svelte';
  import Tabs from '~/src/components/molecules/Tabs.svelte';
  import ShopfrontPlayerTab from '~/src/components/sheets/tabs/ShopfrontPlayerTab.svelte';
  import InventoryPlayerTab from '~/src/components/sheets/tabs/InventoryPlayerTab.svelte';
  import BasketTab from '~/src/components/sheets/tabs/BasketTab.svelte';
  import { localize } from '~/src/helpers/utility.js';

  export let documentStore;

  setContext('#doc', documentStore);

  let activeTab = 'shopfront';
  let filterText = '';

  $: actor = $documentStore;
  $: isEditing = actor?.system?.identity?.isEditing ?? false;

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
    localize,
    clearFilter,
    onFilterChange: (value) => {
      filterText = value;
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