<script>
  import { getContext } from 'svelte';
  import DropZone from '~/src/components/molecules/DropZone.svelte';
  import { shopConfig } from '~/src/stores/shopConfig.js';

  export let sharedProps = {};

  // Get the shopConfig store from context (set by ShopSheetGM)
  const config = getContext('shopConfig') || shopConfig;

  let rollTables = [];
  let rollTableRolls = [];

  $: rollTables = Array.isArray($config.rollTables) ? $config.rollTables : [];
  $: rollTableRolls = normalizeRollTableRolls(rollTables, $config.rollTableRolls);
  $: syncRollTableRolls(rollTables, rollTableRolls, $config.rollTableRolls);

  function formatFactor(value, fallback) {
    const factor = Number(value ?? fallback);
    return Number.isFinite(factor) ? factor : fallback;
  }

  function onSaleFactorInput(event) {
    config.update((current) => ({ ...current, salePriceFactor: Number(event.target.value) }));
  }

  function onBuyFactorInput(event) {
    config.update((current) => ({ ...current, buyPriceFactor: Number(event.target.value) }));
  }

  function normalizeRollTableRolls(tables, rolls) {
    const tableList = Array.isArray(tables) ? tables : [];
    const rollList = Array.isArray(rolls) ? rolls : [];
    return tableList.map((_, index) => {
      const count = Number.parseInt(rollList[index], 10);
      return Number.isFinite(count) && count > 0 ? count : 1;
    });
  }

  function arraysEqual(left, right) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => value === right[index]);
  }

  function syncRollTableRolls(tables, normalizedRolls, currentRolls) {
    if (arraysEqual(normalizedRolls, currentRolls)) return;
    config.update((current) => ({
      ...current,
      rollTableRolls: normalizedRolls,
    }));
  }

  function getRollTableKey(entry) {
    if (typeof entry === 'object' && entry !== null) return entry.uuid || entry.id;
    return entry;
  }

  async function resolveRollTable(data) {
    if (!data || data.type !== 'RollTable') return null;

    if (data.uuid) {
      try {
        const table = await fromUuid(data.uuid);
        if (table) return table;
      } catch (err) {
        console.error('RollTable UUID resolve error:', err);
      }
    }

    if (data.id) return game.tables.get(data.id) ?? null;

    try {
      return await RollTable.implementation.fromDropData(data);
    } catch (err) {
      console.error('RollTable drop resolve error:', err);
      return null;
    }
  }

  function toRollTableEntry(table) {
    return {
      id: table.id,
      uuid: table.uuid,
      name: table.name,
      img: table.img || null,
    };
  }

  function formatRollTableName(entry) {
    if (typeof entry === 'object' && entry !== null) {
      return entry.name || sharedProps.getRollTableName?.(entry) || entry.uuid || entry.id;
    }
    return sharedProps.getRollTableName?.(entry) || entry;
  }

  function formatRollTableImage(entry) {
    if (typeof entry === 'object' && entry !== null) return entry.img || 'icons/svg/d20-grey.svg';
    return 'icons/svg/d20-grey.svg';
  }

  async function handleRollTableDrop(data) {
    if (!sharedProps.isEditing) {
      ui.notifications.error(sharedProps.localize('EditModeRequired'));
      return;
    }

    const table = await resolveRollTable(data);
    if (!table) {
      ui.notifications.warn(sharedProps.localize('CouldNotResolveRollTable') || 'Could not resolve roll table.');
      return;
    }

    const entry = toRollTableEntry(table);
    if (rollTables.some((existing) => getRollTableKey(existing) === getRollTableKey(entry))) return;

    config.update((current) => ({
      ...current,
      rollTables: [...rollTables, entry],
      rollTableRolls: [...rollTableRolls, 1],
    }));
    await sharedProps.silentSaveSettings?.();
  }

  async function removeRollTable(index) {
    config.update((current) => ({
      ...current,
      rollTables: rollTables.filter((_, i) => i !== index),
      rollTableRolls: rollTableRolls.filter((_, i) => i !== index),
    }));
    await sharedProps.silentSaveSettings?.();
  }

  function setRollTableRollCount(index, value) {
    const nextRolls = [...rollTableRolls];
    const count = Number.parseInt(value, 10);
    nextRolls[index] = Number.isFinite(count) && count > 0 ? count : 1;
    config.update((current) => ({
      ...current,
      rollTableRolls: normalizeRollTableRolls(rollTables, nextRolls),
    }));
  }

  function handleRollCountInput(event) {
    setRollTableRollCount(
      Number(event.currentTarget.dataset.index),
      event.currentTarget.value
    );
  }

  function handleRollCountStepClick(event) {
    const index = Number(event.currentTarget.dataset.index);
    const delta = Number(event.currentTarget.dataset.delta);
    setRollTableRollCount(index, (rollTableRolls[index] ?? 1) + delta);
  }

  function handleRemoveRollTableClick(event) {
    removeRollTable(Number(event.currentTarget.dataset.index));
  }

  function openRollTable(entry) {
    const table = typeof entry === 'object' && entry !== null
      ? (entry.uuid ? fromUuidSync(entry.uuid) : game.tables.get(entry.id))
      : (entry?.includes?.('.') ? fromUuidSync(entry) : game.tables.get(entry));
    table?.sheet?.render(true);
  }

  function handleOpenRollTableClick(event) {
    openRollTable(rollTables[Number(event.currentTarget.dataset.index)]);
  }
</script>

<template lang="pug">
  div.settings-tab
    div.settings-form.ma-lg
      label.setting-control
        div.setting-label
          span {sharedProps.localize("SalePriceFactor")}
          strong {formatFactor($config.salePriceFactor, 100)}%
        input(type="range" bind:value!="{ $config.salePriceFactor }" min="50" max="200" step="1" on:input!="{onSaleFactorInput}")
        div.setting-range
          span 50%
          span 200%
        p.setting-help Affects prices charged to buyers.
      label.setting-control
        div.setting-label
          span {sharedProps.localize("BuyPriceFactor")}
          strong {formatFactor($config.buyPriceFactor, 50)}%
        input(type="range" bind:value!="{ $config.buyPriceFactor }" min="50" max="200" step="1" on:input!="{onBuyFactorInput}")
        div.setting-range
          span 50%
          span 200%
        p.setting-help Affects prices paid when buying from actors.
      //- label
      //-   div.setting-label
      //-     span {sharedProps.localize("PriceVariance")}
      //-     strong {sharedProps.priceVariance}%
      //-   input(type="range" value="{sharedProps.priceVariance}" min="0" max="50" step="1" on:input!="{(e) => sharedProps.onPriceVarianceChange?.(e.target.value)}")
      //-   div.setting-range
      //-     span 0%
      //-     span 50%
      //-   p.setting-help (random element per item)
      //- label
      //-   div.setting-label
      //-     span {sharedProps.localize("Atrophy")}
      //-     strong {sharedProps.atrophyPercent}%
      //-   input(type="range" value="{sharedProps.atrophyPercent}" min="0" max="30" step="1" on:input!="{(e) => sharedProps.onAtrophyPercentChange?.(e.target.value)}")
      //-   div.setting-range
      //-     span 0%
      //-     span 30%
      //-   p.setting-help (chance to remove old stock on provision)
      //- label
      //-   | {sharedProps.localize("VariancePeriod")}
      //-   select(value="{sharedProps.variancePeriod}" on:change!="{(e) => sharedProps.onVariancePeriodChange?.(e.target.value)}")
      //-     option(value="daily") {sharedProps.localize("Daily")}
      //-     option(value="weekly") {sharedProps.localize("Weekly")}
      //-     option(value="monthly") {sharedProps.localize("Monthly")}
      div.rolltables-section
        h2 {sharedProps.localize("RollTables")} ({rollTables.length})
        DropZone(placeholder="{sharedProps.localize('DragRollTablesHere')}" acceptType="RollTable" onDrop="{handleRollTableDrop}")
          +if("rollTables.length > 0")
            ul.rolltable-bucket__list
              +each("rollTables as rtUuid, index")
                li.rolltable-bucket__entry
                  button.rolltable-bucket__open(type="button" data-index="{index}" on:click!="{handleOpenRollTableClick}")
                    img.rolltable-bucket__img(src="{formatRollTableImage(rtUuid)}" alt="{formatRollTableName(rtUuid)}")
                    span.rolltable-bucket__name {formatRollTableName(rtUuid)}
                  div.rolltable-bucket__rolls
                    button.rolltable-bucket__step(type="button" data-index="{index}" data-delta="-1" data-tooltip="{sharedProps.localize('Decrease')}" on:click!="{handleRollCountStepClick}")
                      i.fa.fa-minus
                    input.rolltable-bucket__count(type="number" min="1" step="1" data-index="{index}" value="{rollTableRolls[index] ?? 1}" aria-label="{sharedProps.localize('RollCount')}" on:input!="{handleRollCountInput}")
                    button.rolltable-bucket__step(type="button" data-index="{index}" data-delta="1" data-tooltip="{sharedProps.localize('Increase')}" on:click!="{handleRollCountStepClick}")
                      i.fa.fa-plus
                  button.rolltable-bucket__remove(type="button" data-index="{index}" data-tooltip="{sharedProps.localize('Types.Actor.ActionButtons.Delete')}" on:click!="{handleRemoveRollTableClick}")
                    i.fa.fa-trash
          +if("rollTables.length === 0")
            p.rolltable-bucket__empty No roll tables configured. Drag some here to enable provisioning.
      div.actions
        button.provision-btn(type="button" on:click!="{sharedProps.provisionStore}")
          | {sharedProps.localize("ProvisionStore")}
        button.save-btn(type="button" on:click!="{sharedProps.saveSettings}")
          | Save Settings
</template>
<style lang="sass">
  :global(.settings-tab)
    display: flex
    flex-direction: column
    gap: 1rem

  :global(.settings-form)
    display: flex
    flex-direction: column
    gap: 1rem

  :global(.setting-control)
    display: flex
    flex-direction: column
    gap: 0.35rem

  :global(.setting-label),
  :global(.setting-range),
  :global(.actions)
    display: flex
    align-items: center
    justify-content: space-between
    gap: 0.75rem

  :global(.setting-help)
    margin: 0
    opacity: 0.75
    font-size: 0.85em

  :global(.settings-tab input[type="range"])
    padding: 0

  :global(.rolltables-section)
    display: flex
    flex-direction: column
    gap: 0.5rem

    h2
      margin: 0

    :global(.drag-drop-area)
      display: flex
      flex-direction: column
      gap: 0.5rem

  .rolltable-bucket__list
    list-style: none
    margin: 0
    padding: 0
    display: flex
    flex-direction: column
    gap: 0.25rem

  .rolltable-bucket__entry
    display: flex
    align-items: center
    gap: 0.4rem
    min-height: 32px

  .rolltable-bucket__open
    flex: 1
    min-width: 0
    display: grid
    grid-template-columns: 28px minmax(0, 1fr)
    align-items: center
    gap: 0.5rem
    padding: 0.2rem 0.35rem
    border: 0
    background: transparent
    color: var(--gas-color-text)
    text-align: left
    cursor: pointer

    &:hover
      color: var(--gas-tab-active-color)
      background: color-mix(in srgb, var(--gas-tab-active-indicator) 10%, transparent)
      border-radius: 3px

  .rolltable-bucket__img
    width: 24px
    height: 24px
    object-fit: cover
    border: 0
    border-radius: 3px
    max-width: 24px
    max-height: 24px
    margin-right: 0.5rem

  .rolltable-bucket__name
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

  .rolltable-bucket__rolls
    flex: 0 0 auto
    display: inline-grid
    grid-template-columns: 22px 42px 22px
    align-items: center
    gap: 2px
    margin-left: 0.5rem

  .rolltable-bucket__step
    width: 22px
    height: 22px
    display: inline-flex
    align-items: center
    justify-content: center
    padding: 0
    border: 0
    border-radius: 3px
    background: color-mix(in srgb, var(--gas-color-text) 10%, transparent)
    color: var(--gas-color-text)
    cursor: pointer
    font-size: 0.65rem

    &:hover
      background: color-mix(in srgb, var(--gas-tab-active-indicator) 20%, transparent)
      color: var(--gas-tab-active-color)

  .rolltable-bucket__count
    width: 42px
    height: 22px
    min-width: 0
    padding: 0 0.25rem
    text-align: center
    font-size: 0.8rem

  .rolltable-bucket__remove
    width: 24px
    height: 24px
    flex: 0 0 24px
    margin-left: 0.5rem
    display: inline-flex
    align-items: center
    justify-content: center
    padding: 0
    border: 0
    background: transparent
    color: var(--gas-color-text)
    cursor: pointer
    opacity: 0.65

    &:hover
      opacity: 1
      color: var(--gas-color-negative)

  .rolltable-bucket__empty
    margin: 0
    color: color-mix(in srgb, var(--gas-color-text) 50%, transparent)
    font-style: italic
    font-size: 0.9em

  :global(.actions)
    justify-content: flex-start
    flex-wrap: wrap
</style>
