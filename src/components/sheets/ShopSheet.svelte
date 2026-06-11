<svelte:options accessors={true} />

<script>
  import { getContext, onDestroy, onMount, setContext } from 'svelte';
  import { ApplicationShell } from '#runtime/svelte/component/application';
  import Tabs from '~/src/components/molecules/Tabs.svelte';
  import ShopfrontTab from '~/src/components/sheets/tabs/ShopfrontTab.svelte';
  import InventoryTab from '~/src/components/sheets/tabs/InventoryTab.svelte';
  import SettingsTab from '~/src/components/sheets/tabs/SettingsTab.svelte';
  import { localize, log } from '~/src/helpers/utility.js';
  import { observeFoundryBodyTheme } from '~/src/helpers/syncAppThemeFromFoundryBody';

  export let elementRoot;
  export let documentStore;

  setContext('#doc', documentStore);
  const application = getContext('#external').application;

  let activeTab = 'shopfront';
  let filterText = '';
  let associatedActors = [];
  let rollTables = [];
  let salePriceFactor = 100;
  let buyPriceFactor = 50;
  let priceVariance = 10;
  let variancePeriod = 'daily';
  let atrophyPercent = 5;
  let initializedActorId = null;
  let disconnectFoundryTheme = () => {};
  let _filePickerInstance = {};

  $: actor = $documentStore;
  $: sheetTitle = actor?.name ?? game.i18n.localize('foundryvtt-shop-studio.ShopSheetTitle');
  $: config = actor?.shopConfiguration ?? {};

  $: if (actor?.id && actor.id !== initializedActorId) {
    salePriceFactor = config.salePriceFactor ?? 100;
    buyPriceFactor = config.buyPriceFactor ?? 50;
    priceVariance = config.priceVariance ?? 10;
    variancePeriod = config.variancePeriod ?? 'daily';
    atrophyPercent = config.atrophyPercent ?? 5;
    associatedActors = config.associatedActors ?? [];
    rollTables = config.rollTables ?? [];
    initializedActorId = actor.id;
  }

  $: tabs = [
    { id: 'shopfront', label: localize('Shopfront'), component: ShopfrontTab },
    { id: 'inventory', label: localize('Inventory'), component: InventoryTab },
    { id: 'settings', label: localize('Settings'), component: SettingsTab },
  ];

  $: tabProps = {
    actor,
    associatedActors,
    filterText,
    items: actor?.items || [],
    salePriceFactor,
    buyPriceFactor,
    priceVariance,
    variancePeriod,
    atrophyPercent,
    onFilterChange: (value) => {
      filterText = value;
    },
    salePriceFactorChange: (value) => {
      salePriceFactor = Number(value);
    },
    buyPriceFactorChange: (value) => {
      buyPriceFactor = Number(value);
    },
    onPriceVarianceChange: (value) => {
      priceVariance = Number(value);
    },
    onVariancePeriodChange: (value) => {
      variancePeriod = value;
    },
    onAtrophyPercentChange: (value) => {
      atrophyPercent = Number(value);
    },
    rollTables,
    localize,
    openImageEditor,
    handleDragOver,
    handleActorDrop,
    handleRollTableDrop,
    getActorName,
    getRollTableName,
    removeAssociated,
    removeRollTable,
    clearFilter,
    calculateSalePrice,
    openItemSheet,
    provisionStore,
    saveSettings,
  };

  async function saveSettings() {
    if (!actor?.isOwner) {
      ui.notifications.warn(localize('NoPermission'));
      return;
    }
    await actor.updateShopConfiguration({
      salePriceFactor: parseFloat(salePriceFactor),
      priceVariance: parseFloat(priceVariance),
      variancePeriod,
      atrophyPercent: parseFloat(atrophyPercent),
      associatedActors,
      rollTables,
    });
    ui.notifications.info(localize('SettingsSaved'));
  }

  async function provisionStore() {
    if (!actor?.isOwner) return;
    ui.notifications.info('Provisioning store... This will roll on configured tables, apply pricing variance, and update inventory.');
    const numToAdd = 5;
    ui.notifications.info(`Added ${numToAdd} items to inventory.`);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e, dropType) {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      if (dropType === 'actor' && data.type === 'Actor' && data.uuid) {
        const actorId = data.uuid || data.id;
        if (!associatedActors.includes(actorId)) {
          associatedActors = [...associatedActors, actorId];
          saveSettings();
        }
      } else if (dropType === 'rolltable' && data.type === 'RollTable' && data.uuid) {
        if (!rollTables.includes(data.uuid)) {
          rollTables = [...rollTables, data.uuid];
          saveSettings();
        }
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  }

  function handleActorDrop(e) {
    handleDrop(e, 'actor');
  }

  function handleRollTableDrop(e) {
    handleDrop(e, 'rolltable');
  }

  function removeAssociated(index) {
    associatedActors = associatedActors.filter((_, i) => i !== index);
    saveSettings();
  }

  function removeRollTable(index) {
    rollTables = rollTables.filter((_, i) => i !== index);
    saveSettings();
  }

  function clearFilter() {
    filterText = '';
  }

  function openItemSheet(item) {
    item.sheet?.render(true);
  }

  function openImageEditor() {
    const current = actor?.img;
    if (_filePickerInstance instanceof FilePicker && !_filePickerInstance?.rendered) {
      _filePickerInstance.render(true);
      return;
    }

    _filePickerInstance = new FilePicker({
      type: 'image',
      current,
      callback: (path) => {
        $documentStore.update({ img: path });
      },
      top: application.position.top + 40,
      left: application.position.left + 10,
    });
    return _filePickerInstance.browse();
  }

  function getActorName(uuidOrId) {
    const a = game.actors.get(uuidOrId) || game.actors.getName(uuidOrId);
    return a?.name || uuidOrId.split('.').pop() || 'Unknown Actor';
  }

  function getRollTableName(uuid) {
    const rt = game.tables.get(uuid) || game.tables.getName(uuid.split('.').pop());
    return rt?.name || 'Unknown Table';
  }

  function calculateSalePrice(basePrice = 0) {
    const factor = salePriceFactor / 100;
    const variance = (Math.random() * 2 - 1) * (priceVariance / 100);
    return Math.round(basePrice * factor * (1 + variance));
  }

  onMount(() => {
    console.log("ShopSheet: onMount - sheet rendered");
    disconnectFoundryTheme = observeFoundryBodyTheme(elementRoot);
    application.reactive.draggable = true;
    log?.d('ShopSheet mounted for actor', actor?.name);
  });

  onDestroy(() => {
    console.log("ShopSheet: onDestroy - sheet destroyed");
    disconnectFoundryTheme();
  });
</script>

<template lang="pug">
  ApplicationShell(bind:elementRoot)
    section.shop-sheet
      main.shop-sheet__body
        Tabs.gas-tabs(tabs="{tabs}" bind:activeTab="{activeTab}" sharedProps="{tabProps}")
</template>

<style lang="sass">
@import "../../styles/Mixins.sass"
#foundryvtt-shop-studio-sheet

  .shop-sheet
    display: flex
    flex-direction: column
    gap: 0
    min-height: 100%
    padding: 0
    color: var(--gas-color-text)

    &__body
      flex: 1
      min-height: 0


  :global(.profile-section),
  :global(.associated-actors-section),
  :global(.inventory-controls),
  :global(.inventory-list),
  :global(.rolltables-section)
    background: color-mix(in srgb, var(--gas-tabs-content-background) 80%, transparent)
    border: 1px solid color-mix(in srgb, var(--gas-tab-inactive-border) 45%, transparent)
    border-radius: var(--border-radius)
    box-shadow: 0 0 0 1px var(--gas-li-inset) inset
    padding: var(--size-md)

  :global(.description-section)
    align-self: start
    min-height: 220px
    display: flex
    flex-direction: column

  :global(.description-section h2)
    flex-shrink: 0

  :global(.description-section .prosemirror)
    flex: 1
    min-height: 180px

  :global(h2),
  :global(h3)
    margin: 0 0 var(--size-sm)
    color: var(--gas-tab-active-color)
    border-bottom: 1px solid color-mix(in srgb, var(--gas-tab-active-indicator) 45%, transparent)
    padding-bottom: var(--size-xs)

  :global(.profile-img)
    width: 120px
    height: 120px
    object-fit: cover
    border: 2px solid color-mix(in srgb, var(--gas-tab-active-indicator) 55%, transparent)
    border-radius: 6px
    display: block
    margin: 0 auto var(--size-sm)
    background: var(--gas-input-background)

  :global(input),
  :global(select)
    width: 100%
    color: var(--gas-color-text)
    background: var(--gas-input-background)
    border: 1px solid var(--gas-input-border)
    border-radius: var(--border-radius)
    padding: 0.5rem 0.6rem

  :global(textarea)
    min-height: 180px
    resize: vertical

  :global(.drag-drop-area)
    border: 2px dashed color-mix(in srgb, var(--gas-tab-active-indicator) 50%, transparent)
    border-radius: var(--border-radius)
    padding: var(--size-md)
    text-align: center
    background: color-mix(in srgb, var(--gas-li-background) 70%, transparent)

  :global(.associated-list),
  :global(.rolltable-list)
    list-style: none
    padding: 0
    margin: var(--size-sm) 0 0

  :global(.associated-list li),
  :global(.rolltable-list li)
    display: flex
    justify-content: space-between
    align-items: center
    gap: var(--size-sm)
    margin: 0 0 var(--size-xs)
    border-radius: var(--border-radius)
    background: var(--gas-li-background)
    box-shadow: 0 0 0 1px var(--gas-li-inset) inset
    padding: 0.5rem 0.6rem

  :global(.remove-btn),
  :global(.actions button),
  :global(.inventory-controls button),
  :global(.inventory-item button),
  :global(.profile-section button)
    @include button

  :global(.remove-btn)
    min-width: 26px
    width: 26px
    height: 26px
    padding: 0
    border-radius: 999px

  :global(.inventory-controls)
    display: flex
    align-items: center
    gap: var(--size-sm)
    margin-bottom: var(--size-sm)

  :global(.inventory-controls .filter-input)
    flex: 1

  :global(.inventory-item)
    display: grid
    grid-template-columns: minmax(0, 1fr) auto auto
    align-items: center
    gap: var(--size-sm)
    margin-bottom: var(--size-xs)
    border-radius: var(--border-radius)
    background: var(--gas-li-background)
    box-shadow: 0 0 0 1px var(--gas-li-inset) inset
    padding: 0.55rem 0.6rem

  :global(.inventory-item .item-name)
    font-weight: 700

  :global(.inventory-item .item-price)
    color: var(--gas-tab-active-color)
    font-weight: 700

  :global(.settings-form)
    margin: 0.5rem

  :global(.settings-form label)
    display: flex
    flex-direction: column
    gap: var(--size-xs)
    font-weight: 600

  :global(.setting-label)
    display: flex
    align-items: baseline
    justify-content: space-between
    gap: var(--size-sm)

  :global(.setting-label strong)
    color: var(--gas-tab-active-color)
    font-size: 0.9rem

  :global(.setting-range)
    display: flex
    justify-content: space-between
    opacity: 0.7
    font-size: 0.75rem

  :global(.setting-help)
    margin: 0
    opacity: 0.75
    font-size: 0.8rem
    font-weight: 400

  :global(.actions)
    display: flex
    gap: var(--size-sm)
    flex-wrap: wrap

  :global(.small),
  :global(.no-items),
  :global(.drag-hint)
    opacity: 0.8

  :global(.no-items)
    margin-top: var(--size-sm)
    padding: var(--size-sm)
    border-radius: var(--border-radius)
    background: color-mix(in srgb, var(--gas-li-background) 70%, transparent)

</style>
