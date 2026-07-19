<svelte:options accessors={true} />

<script>
  import { setContext } from 'svelte';
  import Tabs from '~/src/components/molecules/Tabs.svelte';
  import ShopfrontPlayerTab from '~/src/components/sheets/tabs/ShopfrontPlayerTab.svelte';
  import InventoryPlayerTab from '~/src/components/sheets/tabs/InventoryPlayerTab.svelte';
  import BasketTab from '~/src/components/sheets/tabs/BasketTab.svelte';
  import { localize } from '~/src/helpers/utility.js';
  import { MODULE_ID } from '~/src/helpers/constants.ts';
  import { shopTelemetry } from '~/src/helpers/telemetry.js';
  import { registerShopTargetActor, registerShopTargetEntries } from '~/src/helpers/shopTargets.js';
  import { getShopConfiguration, isShopEditing } from '~/src/helpers/shopIdentity.js';

  export let documentStore;
  export let targetActorId = null;

  setContext('#doc', documentStore);

  let activeTab = 'shopfront';
  let filterText = '';
  let selectedActorId = null;
  let _shopIdRestored = null;

  $: actor = $documentStore;
  $: shopId = actor?.id ?? null;
  $: config = getShopConfiguration(actor);
  $: isEditing = isShopEditing(actor);

  /** Restore persisted selected actor once the shop actor is available. */
  $: if (shopId && shopId !== _shopIdRestored) {
    _shopIdRestored = shopId;
    selectedActorId = game.user.getFlag(MODULE_ID, `selectedActor.${shopId}`) ?? null;
    shopTelemetry('ShopSheetPlayer', 'restored selected actor', {
      shopId,
      actorUuid: actor?.uuid,
      selectedActorId,
      basketActorIds: Object.keys(actor?.flags?.[MODULE_ID]?.basket ?? {}),
      associatedActors: config.associatedActors ?? [],
    });
    if (actor && selectedActorId && actor.isOwner) {
      registerShopTargetActor(actor, selectedActorId, { source: 'player-restored-selection' });
    }
  }

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
    salePriceFactor: config.salePriceFactor ?? 100,
    localize,
    clearFilter,
    onFilterChange: (value) => {
      filterText = value;
    },
    onTargetActorChange: selectTargetActor,
    associatedActors: config.associatedActors ?? [],
    getActorName,
  };

  function clearFilter() {
    filterText = '';
  }

  function getActorName(id) {
    const a = game.actors.get(id);
    return a?.name || id || 'Unknown Actor';
  }

  async function selectTargetActor(id, targetEntry = null) {
    shopTelemetry('ShopSheetPlayer', 'select target actor', {
      shopId,
      actorUuid: actor?.uuid,
      previousSelectedActorId: selectedActorId,
      nextSelectedActorId: id,
      targetEntry,
      basketActorIds: Object.keys(actor?.flags?.[MODULE_ID]?.basket ?? {}),
    });
    selectedActorId = id;
    if (shopId) {
      await game.user.setFlag(MODULE_ID, `selectedActor.${shopId}`, id ?? '');
    }
    if (actor && targetEntry && actor.isOwner) {
      await registerShopTargetEntries(actor, [{
        ...targetEntry,
        source: 'player-selection',
        userId: game.user?.id,
        timestamp: Date.now(),
      }]);
    } else if (actor && id && actor.isOwner) {
      await registerShopTargetActor(actor, id, { source: 'player-selection' });
    }
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
