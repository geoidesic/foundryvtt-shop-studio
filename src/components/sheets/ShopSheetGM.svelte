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
import { registerShopTargetActor, registerShopTargetEntries } from '~/src/helpers/shopTargets.js';
import { getShopConfiguration, isShopEditing, setShopConfiguration } from '~/src/helpers/shopIdentity.js';
import { isItemTypeListable, getItemSourcePacks } from '~/src/helpers/itemSources.js';
import { shopConfig } from '~/src/stores/shopConfig.js';

export let documentStore;

const application = getContext('#external').application;

  setContext('#doc', documentStore);
  setContext('shopConfig', shopConfig);

  let activeTab = 'shopfront';
  let filterText = '';
  let associatedActors = [];
  let rollTables = [];
  let rollTableRolls = [];
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
  $: config = getShopConfiguration(actor);
  $: isEditing = isShopEditing(actor);

  // Initialize shopConfig store from actor flags when actor changes
  $: if (actor?.id && actor.id !== initializedActorId) {
    const config = getShopConfiguration(actor);
    shopConfig.set({
      salePriceFactor: config.salePriceFactor ?? 100,
      buyPriceFactor: config.buyPriceFactor ?? 50,
      priceVariance: config.priceVariance ?? 10,
      variancePeriod: config.variancePeriod ?? 'daily',
      atrophyPercent: config.atrophyPercent ?? 5,
      associatedActors: config.associatedActors ?? [],
      rollTables: config.rollTables ?? [],
      rollTableRolls: normalizeRollTableRolls(config.rollTables ?? [], config.rollTableRolls ?? []),
      provisionMode: config.provisionMode ?? 'rolltable',
      compendiumProvision: config.compendiumProvision ?? []
    });
    initializedActorId = actor.id;
  }

  // Sync local variables from store for backward compatibility
  $: salePriceFactor = $shopConfig.salePriceFactor;
  $: buyPriceFactor = $shopConfig.buyPriceFactor;
  $: priceVariance = $shopConfig.priceVariance;
  $: variancePeriod = $shopConfig.variancePeriod;
  $: atrophyPercent = $shopConfig.atrophyPercent;
  $: associatedActors = $shopConfig.associatedActors;
  $: rollTables = $shopConfig.rollTables;
  $: rollTableRolls = $shopConfig.rollTableRolls;

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
      shopConfig.update((current) => ({
        ...current,
        associatedActors: list,
      }));
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
    provisionMode: $shopConfig.provisionMode,
    compendiumProvision: $shopConfig.compendiumProvision,
    onProvisionModeChange: (mode) => {
      shopConfig.update((current) => ({ ...current, provisionMode: mode }));
    },
    onCompendiumProvisionChange: (next) => {
      shopConfig.update((current) => ({ ...current, compendiumProvision: next }));
    },
  };

  async function selectTargetActor(id, targetEntry = null) {
    shopTelemetry('ShopSheetGM', 'select target actor', {
      shopId: actor?.id,
      actorUuid: actor?.uuid,
      previousSelectedActorId: selectedActorId,
      nextSelectedActorId: id,
      targetEntry,
      basketActorIds: Object.keys(actor?.flags?.[MODULE_ID]?.basket ?? {}),
      associatedActors,
    });
    selectedActorId = id;
    if (actor?.id) {
      await game.user.setFlag(MODULE_ID, `selectedActor.${actor.id}`, id ?? '');
    }
    if (actor && targetEntry) {
      await registerShopTargetEntries(actor, [{
        ...targetEntry,
        source: 'gm-selection',
        userId: game.user?.id,
        timestamp: Date.now(),
      }]);
    } else if (actor && id) {
      await registerShopTargetActor(actor, id, { source: 'gm-selection' });
    }
  }

  async function saveSettings() {
    if (!actor?.isOwner) {
      ui.notifications.warn(localize('NoPermission'));
      return;
    }
    const nextConfig = {
      ...$shopConfig,
      salePriceFactor: parseFloat($shopConfig.salePriceFactor),
      buyPriceFactor: parseFloat($shopConfig.buyPriceFactor),
      priceVariance: parseFloat($shopConfig.priceVariance),
      variancePeriod: $shopConfig.variancePeriod,
      atrophyPercent: parseFloat($shopConfig.atrophyPercent),
      associatedActors: $shopConfig.associatedActors,
      rollTables: $shopConfig.rollTables,
      rollTableRolls: normalizeRollTableRolls($shopConfig.rollTables, $shopConfig.rollTableRolls),
      provisionMode: $shopConfig.provisionMode,
      compendiumProvision: $shopConfig.compendiumProvision,
    };
    await setShopConfiguration(actor, nextConfig);
    shopConfig.set(nextConfig);
    ui.notifications.info(localize('SettingsSaved'));
  }

  async function silentSaveSettings() {
    if (!actor?.isOwner) return;
    const nextConfig = {
      ...$shopConfig,
      salePriceFactor: parseFloat($shopConfig.salePriceFactor),
      buyPriceFactor: parseFloat($shopConfig.buyPriceFactor),
      priceVariance: parseFloat($shopConfig.priceVariance),
      variancePeriod: $shopConfig.variancePeriod,
      atrophyPercent: parseFloat($shopConfig.atrophyPercent),
      associatedActors: $shopConfig.associatedActors,
      rollTables: $shopConfig.rollTables,
      rollTableRolls: normalizeRollTableRolls($shopConfig.rollTables, $shopConfig.rollTableRolls),
      provisionMode: $shopConfig.provisionMode,
      compendiumProvision: $shopConfig.compendiumProvision,
    };
    await setShopConfiguration(actor, nextConfig);
    shopConfig.set(nextConfig);
  }

  async function provisionStore() {
    if (!actor?.isOwner) {
      ui.notifications.warn(localize('NoPermission'));
      return;
    }

    if (($shopConfig.provisionMode ?? 'rolltable') === 'compendium') {
      await provisionStoreFromCompendium();
      return;
    }

    const configuredTables = Array.isArray($shopConfig.rollTables) ? $shopConfig.rollTables : [];
    const configuredRolls = normalizeRollTableRolls(configuredTables, $shopConfig.rollTableRolls);
    if (!configuredTables.length) {
      ui.notifications.warn(localize('NoRollTablesConfigured') || 'No roll tables configured.');
      return;
    }

    ui.notifications.info(localize('ProvisioningStore') || 'Provisioning store...');

    const items = await rollProvisionItems(configuredTables, configuredRolls);
    if (!items.length) {
      ui.notifications.warn(localize('ProvisionNoItems') || 'No item results were rolled.');
      return;
    }

    const addedCount = await upsertProvisionItems(items);
    ui.notifications.info(
      game.i18n.format(`${MODULE_ID}.ProvisionComplete`, { count: addedCount })
        || `Added ${addedCount} items to inventory.`
    );
  }

  async function provisionStoreFromCompendium() {
    const provision = Array.isArray($shopConfig.compendiumProvision) ? $shopConfig.compendiumProvision : [];
    const activeEntries = provision.filter((entry) => entry && entry.type && entry.quantity > 0);
    if (!activeEntries.length) {
      ui.notifications.warn(localize('NoCompendiumProvisionConfigured') || 'No compendium item types configured for provisioning.');
      return;
    }

    const totalQuantity = activeEntries.reduce((sum, entry) => sum + Number(entry.quantity ?? 0), 0);
    if (totalQuantity <= 0) {
      ui.notifications.warn(localize('NoCompendiumProvisionConfigured') || 'No compendium item types configured for provisioning.');
      return;
    }

    ui.notifications.info(localize('ProvisioningStore') || 'Provisioning store...');

    const items = await compendiumProvisionItems(activeEntries, totalQuantity);
    if (!items.length) {
      ui.notifications.warn(localize('ProvisionNoItems') || 'No item results were drawn.');
      return;
    }

    const addedCount = await upsertProvisionItems(items);
    ui.notifications.info(
      game.i18n.format(`${MODULE_ID}.ProvisionComplete`, { count: addedCount })
        || `Added ${addedCount} items to inventory.`
    );
  }

  async function compendiumProvisionItems(entries, totalQuantity) {
    const packs = getItemSourcePacks();
    if (!packs.length) {
      ui.notifications.warn(localize('NoItemSourcesConfigured') || 'No item sources configured. Set them in module settings.');
      return [];
    }

    const typeToQuantity = new Map();
    for (const entry of entries) {
      typeToQuantity.set(entry.type, (typeToQuantity.get(entry.type) ?? 0) + Number(entry.quantity ?? 0));
    }

    const pool = [];
    for (const pack of packs) {
      let index;
      try {
        index = await pack.getIndex({ fields: ['type', 'name', 'img'] });
      } catch (err) {
        console.error('Compendium index error:', err);
        continue;
      }
      for (const entry of index.values()) {
        if (typeToQuantity.has(entry.type) && isItemTypeListable(entry.type)) {
          pool.push({ pack, entry });
        }
      }
    }

    if (!pool.length) {
      return [];
    }

    const items = [];
    for (let drawn = 0; drawn < totalQuantity; drawn += 1) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const document = await pick.pack.getDocument(pick.entry._id);
      if (document?.documentName === 'Item') {
        items.push(document);
      }
    }

    return items;
  }

  function normalizeRollTableRolls(tables = [], rolls = []) {
    const tableList = Array.isArray(tables) ? tables : [];
    const rollList = Array.isArray(rolls) ? rolls : [];
    return tableList.map((_, index) => {
      const count = Number.parseInt(rollList[index], 10);
      return Number.isFinite(count) && count > 0 ? count : 1;
    });
  }

  async function rollProvisionItems(configuredTables, configuredRolls) {
    const rollPlans = [];
    for (const [index, entry] of configuredTables.entries()) {
      const table = await resolveConfiguredRollTable(entry);
      if (table) {
        rollPlans.push({
          table,
          count: Math.max(1, Number(configuredRolls[index] ?? 1)),
        });
      }
    }

    const items = [];
    for (const plan of rollPlans) {
      const results = await drawRollTableResults(plan.table, plan.count);
      for (const result of results) {
        const document = await resolveTableResultDocument(result);
        if (document?.documentName === 'Item' && isItemTypeListable(document.type)) {
          items.push(document);
        }
      }
    }

    return items;
  }

  async function drawRollTableResults(table, count) {
    const drawOptions = { displayChat: false, recursive: true };
    if (typeof table.drawMany === 'function') {
      try {
        return getRollTableDrawResults(await table.drawMany(count, drawOptions));
      } catch (err) {
        console.error('Roll table drawMany error:', err);
      }
    }

    const results = [];
    for (let index = 0; index < count; index += 1) {
      try {
        results.push(...getRollTableDrawResults(await table.draw(drawOptions)));
      } catch (err) {
        console.error('Roll table draw error:', err);
      }
    }
    return results;
  }

  function getRollTableDrawResults(draw) {
    return toArray(draw?.results ?? draw?.RollTableDraw?.results);
  }

  function toArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (Array.isArray(value.contents)) return value.contents;
    if (typeof value.values === 'function') return Array.from(value.values());
    return [];
  }

  async function resolveConfiguredRollTable(entry) {
    if (typeof entry === 'object' && entry !== null) {
      if (entry.uuid) {
        try {
          return await fromUuid(entry.uuid);
        } catch (err) {
          console.error('Configured roll table UUID resolve error:', err);
          return null;
        }
      }
      if (entry.id) return game.tables.get(entry.id) ?? null;
      return null;
    }

    if (entry?.includes?.('.')) {
      try {
        return await fromUuid(entry);
      } catch (err) {
        console.error('Configured roll table UUID resolve error:', err);
        return null;
      }
    }
    return game.tables.get(entry) ?? null;
  }

  async function resolveTableResultDocument(result) {
    if (!result) return null;
    if (result.document) return result.document;

    if (typeof result.getDocument === 'function') {
      try {
        const document = await result.getDocument();
        if (document) return document;
      } catch (err) {
        console.error('Roll table result getDocument error:', err);
      }
    }

    const uuids = getTableResultDocumentUuids(result);
    for (const uuid of uuids) {
      try {
        const document = await fromUuid(uuid);
        if (document) return document;
      } catch (err) {
        console.error('Roll table result UUID resolve error:', err);
      }
    }

    if (result.uuid) {
      try {
        const document = await fromUuid(result.uuid);
        if (document) return document;
      } catch (err) {
        console.error('Roll table result UUID resolve error:', err);
      }
    }

    const collectionName = result.documentCollection;
    const documentId = result.documentId;
    if (!collectionName || !documentId) return null;

    const worldCollection = getWorldCollection(collectionName);
    const worldDocument = worldCollection?.get?.(documentId);
    if (worldDocument) return worldDocument;

    const pack = game.packs?.get(collectionName);
    if (pack) return pack.getDocument(documentId);

    return null;
  }

  function getTableResultDocumentUuids(result) {
    const documentUuid = result.documentUuid ?? result.documentUUID;
    if (documentUuid) return [documentUuid];

    const collectionName = result.documentCollection;
    const documentId = result.documentId;
    if (!collectionName || !documentId) return [];
    if (collectionName.startsWith('Compendium.')) return [`${collectionName}.${documentId}`];
    if (game.packs?.has(collectionName)) return [`Compendium.${collectionName}.${documentId}`];

    const documentName = getDocumentName(collectionName);
    const uuids = [`${collectionName}.${documentId}`];
    if (documentName && documentName !== collectionName) uuids.push(`${documentName}.${documentId}`);
    return uuids;
  }

  function getWorldCollection(collectionName) {
    const documentName = getDocumentName(collectionName);
    return game.collections?.get(collectionName)
      ?? game.collections?.get(documentName)
      ?? game[collectionName]
      ?? game[collectionName.toLowerCase?.()]
      ?? game[`${collectionName.toLowerCase?.()}s`]
      ?? game[`${documentName?.toLowerCase?.()}s`]
      ?? null;
  }

  function getDocumentName(collectionName) {
    if (!collectionName || collectionName.startsWith('Compendium.') || collectionName.includes('.')) return null;
    if (collectionName === 'items') return 'Item';
    return collectionName.charAt(0).toUpperCase() + collectionName.slice(1).replace(/s$/, '');
  }

  async function upsertProvisionItems(items) {
    let addedCount = 0;
    const provisionedByKey = new Map();

    for (const item of items) {
      const key = getProvisionItemKey(item);
      const entry = provisionedByKey.get(key);
      if (entry) {
        entry.quantity += 1;
      } else {
        provisionedByKey.set(key, { item, quantity: 1 });
      }
      addedCount += 1;
    }

    const updates = [];
    const createData = [];

    for (const { item, quantity } of provisionedByKey.values()) {
      const duplicate = actor.items.find((candidate) => getProvisionItemKey(candidate) === getProvisionItemKey(item));
      if (duplicate) {
        updates.push({
          _id: duplicate.id,
          'system.quantity': Number(duplicate.system?.quantity ?? 0) + quantity,
        });
        continue;
      }

      const itemData = item.toObject();
      delete itemData._id;
      itemData.system = itemData.system ?? {};
      itemData.system.quantity = Math.max(1, Number(itemData.system.quantity ?? 1)) + quantity - 1;
      createData.push(itemData);
    }

    if (updates.length) {
      await actor.updateEmbeddedDocuments('Item', updates);
    }

    if (createData.length) {
      await actor.createEmbeddedDocuments('Item', createData);
    }

    return addedCount;
  }

  function getProvisionItemKey(item) {
    return `${item.type}::${item.name}`;
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e, dropType) {
    e.preventDefault();
    if (!isEditing) {
      ui.notifications.error(localize('EditModeRequired'));
      return;
    }

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      if (dropType === 'actor' && data.type === 'Actor' && (data.uuid || data.id)) {
        const actorId = data.id || data.uuid.split('.').pop();
        if (!associatedActors.includes(actorId)) {
          shopConfig.update((current) => ({
            ...current,
            associatedActors: [...associatedActors, actorId],
          }));
          saveSettings();
        }
      } else if (dropType === 'rolltable' && data.type === 'RollTable' && data.uuid) {
        const tableId = data.id || data.uuid.split('.').pop();
        if (!rollTables.includes(tableId)) {
          shopConfig.update((current) => ({
            ...current,
            rollTables: [...rollTables, tableId],
            rollTableRolls: [...normalizeRollTableRolls(rollTables, rollTableRolls), 1],
          }));
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
    shopConfig.update((current) => ({
      ...current,
      associatedActors: associatedActors.filter((_, i) => i !== index),
    }));
    saveSettings();
  }

  function removeRollTable(index) {
    shopConfig.update((current) => ({
      ...current,
      rollTables: rollTables.filter((_, i) => i !== index),
      rollTableRolls: normalizeRollTableRolls(rollTables, rollTableRolls).filter((_, i) => i !== index),
    }));
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

  function getRollTableName(entry) {
    if (typeof entry === 'object' && entry !== null) {
      if (entry.name) return entry.name;
      const uuidTable = entry.uuid ? fromUuidSync(entry.uuid) : null;
      const idTable = entry.id ? game.tables.get(entry.id) : null;
      return uuidTable?.name || idTable?.name || entry.uuid || entry.id || 'Unknown Table';
    }

    const uuidTable = entry?.includes?.('.') ? fromUuidSync(entry) : null;
    const idTable = game.tables.get(entry);
    return uuidTable?.name || idTable?.name || entry || 'Unknown Table';
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
