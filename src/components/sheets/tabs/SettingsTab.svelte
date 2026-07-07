<script>
  import { getContext } from 'svelte';
  import { shopConfig } from '~/src/stores/shopConfig.js';

  export let sharedProps = {};

  // Get the shopConfig store from context (set by ShopSheetGM)
  const config = getContext('shopConfig') || shopConfig;

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
        h3 {sharedProps.localize("RollTables")}
        div.drag-drop-area(role="region" aria-label="Roll table drop zone" on:dragover|preventDefault="{sharedProps.handleDragOver}" on:drop|preventDefault="{sharedProps.handleRollTableDrop}")
          p.drag-hint {sharedProps.localize("DragRollTablesHere")} (from compendium or tables sidebar)
        +if("sharedProps.rollTables && sharedProps.rollTables.length > 0")
          ul.rolltable-list
            +each("sharedProps.rollTables as rtUuid, index")
              li
                span {sharedProps.getRollTableName(rtUuid)}
                button.remove-btn(type="button" on:click!="{() => sharedProps.removeRollTable(index)}") ×
          +else()
            p.no-items No roll tables configured. Drag some here to enable provisioning.
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

  :global(.actions)
    justify-content: flex-start
    flex-wrap: wrap
</style>
