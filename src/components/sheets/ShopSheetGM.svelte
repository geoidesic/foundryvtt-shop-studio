<svelte:options accessors={true} />

<script>
import { getContext, setContext } from 'svelte';
import Tabs from '~/src/components/molecules/Tabs.svelte';
import ShopfrontTab from '~/src/components/sheets/tabs/ShopfrontTab.svelte';
import InventoryTab from '~/src/components/sheets/tabs/InventoryTab.svelte';
import BasketTab from '~/src/components/sheets/tabs/BasketTab.svelte';
import SettingsTab from '~/src/components/sheets/tabs/SettingsTab.svelte';
import { localize } from '~/src/helpers/utility.js';
import { MODULE_ID } from '~/src/helpers/constants';
import { shopTelemetry } from '~/src/helpers/telemetry.js';

export let documentStore;

const application = getContext('#external').application;

  setContext('#doc', documentStore);

  let activeTab = 'shopfront';
  let filterText = '';
  let associatedActors = [];
  let rollTables = [];
  let salePriceFactor = 100;
  let buyPriceFactor = 50;
  let priceVariance = 10;
  let variancePeriod = 'daily';
  let atrophyPercent = 5;
  let selectedActorId = null;
  let initializedActorId = null;
  let restoredSelectionActorId = null;
  let disconnectFoundryTheme = () => {};
  let _filePickerInstance = {};

  $: actor = $documentStore;
  $: sheetTitle = actor?.name ?? game.i18n.localize('foundryvtt-shop-studio.ShopSheetTitle');
  $: config = actor?.system?.shopConfiguration ?? {};
  $: isEditing = actor?.system?.identity?.isEditing ?? false;

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

  $: if (actor?.id && actor.id !== restoredSelectionActorId) {
    restoredSelectionActorId = actor.id;
    selectedActorId = game.user.getFlag(MODULE_ID, `selectedActor.${actor.id}`) ?? null;
    shopTelemetry('ShopSheetGM', 'restored selected actor', {
      shopId: actor.id,
      shopUuid: actor.uuid,
      selectedActorId,
      basketActorIds: Object.keys(actor?.flags?.[MODULE_ID]?.basket ?? {}),
      configuredAssociatedActors: config.associatedActors ?? [],
    });
  }

  $: tabs = [
    { id: 'shopfront', label: localize('Shopfront'), component: ShopfrontTab },
    { id: 'inventory', label: localize('Inventory'), component: InventoryTab },
    { id: 'basket', label: localize('Basket'), component: BasketTab },
    { id: 'settings', label: localize('Settings'), component: SettingsTab },
  ];

  $: tabProps = {
    actor,
    isEditing,
    associatedActors,
    filterText,
    items: actor?.items || [],
    targetActorId: selectedActorId,
    salePriceFactor,
    buyPriceFactor,
    priceVariance,
    variancePeriod,
    atrophyPercent,
    onFilterChange: (value) => {
      filterText = value;
    },
    onSalePriceFactorChange: (value) => {
      salePriceFactor = Number(value);
    },
    onBuyPriceFactorChange: (value) => {
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
    onAssociatedActorsChange: (list) => {
      associatedActors = list;
    },
    onTargetActorChange: selectTargetActor,
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
    silentSaveSettings,
  };

  async function selectTargetActor(id) {
    shopTelemetry('ShopSheetGM', 'select target actor', {
      shopId: actor?.id,
      actorUuid: actor?.uuid,
      previousSelectedActorId: selectedActorId,
      nextSelectedActorId: id,
      basketActorIds: Object.keys(actor?.flags?.[MODULE_ID]?.basket ?? {}),
      associatedActors,
    });
    selectedActorId = id;
    if (actor?.id) {
      await game.user.setFlag(MODULE_ID, `selectedActor.${actor.id}`, id ?? '');
    }
  }

  async function saveSettings() {
    if (!actor?.isOwner) {
      ui.notifications.warn(localize('NoPermission'));
      return;
    }
    await actor.system.updateShopConfiguration({
      salePriceFactor: parseFloat(salePriceFactor),
      buyPriceFactor: parseFloat(buyPriceFactor),
      priceVariance: parseFloat(priceVariance),
      variancePeriod,
      atrophyPercent: parseFloat(atrophyPercent),
      associatedActors,
      rollTables,
    });
    ui.notifications.info(localize('SettingsSaved'));
  }

  async function silentSaveSettings() {
    if (!actor?.isOwner) return;
    await actor.system.updateShopConfiguration({
      salePriceFactor: parseFloat(salePriceFactor),
      buyPriceFactor: parseFloat(buyPriceFactor),
      priceVariance: parseFloat(priceVariance),
      variancePeriod,
      atrophyPercent: parseFloat(atrophyPercent),
      associatedActors,
      rollTables,
    });
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
      if (dropType === 'actor' && data.type === 'Actor' && (data.uuid || data.id)) {
        const actorId = data.id || data.uuid.split('.').pop();
        if (!associatedActors.includes(actorId)) {
          associatedActors = [...associatedActors, actorId];
          saveSettings();
        }
      } else if (dropType === 'rolltable' && data.type === 'RollTable' && data.uuid) {
        const tableId = data.id || data.uuid.split('.').pop();
        if (!rollTables.includes(tableId)) {
          rollTables = [...rollTables, tableId];
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

  function getActorName(id) {
    const a = game.actors.get(id);
    return a?.name || id || 'Unknown Actor';
  }

  function getRollTableName(id) {
    const rt = game.tables.get(id);
    return rt?.name || id || 'Unknown Table';
  }

  function calculateSalePrice(basePrice = 0) {
    const factor = salePriceFactor / 100;
    const variance = (Math.random() * 2 - 1) * (priceVariance / 100);
    return Math.round(basePrice * factor * (1 + variance));
  }

</script>

<template lang="pug">
  section.shop-sheet
    main.shop-sheet__body
      Tabs.gas-tabs(tabs="{tabs}" bind:activeTab="{activeTab}" sharedProps="{tabProps}")
</template>

<style lang="sass">
@import "../../styles/Mixins.sass"
:global(.foundryvtt-shop-studio)
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
    width: 100%
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
    padding: 0.5rem
    border: 2px dashed color-mix(in srgb, var(--gas-tab-active-indicator) 50%, transparent)
</style>
