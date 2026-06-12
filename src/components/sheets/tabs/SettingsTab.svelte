<script>
  export let sharedProps = {};
</script>

<template lang="pug">
  div.settings-tab
    div.settings-form.ma-lg
      label
        div.setting-label
          span {sharedProps.localize("SalePriceFactor")} (affects all prices)&nbsp;
          strong {sharedProps.pricingFactor}%&nbsp;
        input(type="range" value="{sharedProps.salePriceFactor}" min="50" max="200" step="1" on:input!="{(e) => sharedProps.onPricingFactorChange?.(e.target.value)}")
        div.setting-range
          span 50%
          span 200%
        p.setting-help 
      label
        div.setting-label
          span {sharedProps.localize("SalePriceFactor")} (affects all prices)&nbsp;
          strong {sharedProps.pricingFactor}%&nbsp;
        input(type="range" value="{sharedProps.buyPriceFactor}" min="50" max="200" step="1" on:input!="{(e) => sharedProps.onPricingFactorChange?.(e.target.value)}")
        div.setting-range
          span 50%
          span 200%
        p.setting-help 
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
  input[type="range"]
    height: 0
</style>