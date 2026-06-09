<script>
  export let sharedProps = {};
</script>

<template lang="pug">
  div.settings-tab
    div.settings-form
      label
        | {sharedProps.localize("PricingFactor")}
        input(type="number" value="{sharedProps.pricingFactor}" min="50" max="200" step="1" on:input!="{(e) => sharedProps.onPricingFactorChange?.(e.target.value)}")
        span % (affects all prices)
      label
        | {sharedProps.localize("PriceVariance")}
        input(type="number" value="{sharedProps.priceVariance}" min="0" max="50" step="1" on:input!="{(e) => sharedProps.onPriceVarianceChange?.(e.target.value)}")
        span % (random element per item)
      label
        | {sharedProps.localize("VariancePeriod")}
        select(value="{sharedProps.variancePeriod}" on:change!="{(e) => sharedProps.onVariancePeriodChange?.(e.target.value)}")
          option(value="daily") {sharedProps.localize("Daily")}
          option(value="weekly") {sharedProps.localize("Weekly")}
          option(value="monthly") {sharedProps.localize("Monthly")}
      label
        | {sharedProps.localize("Atrophy")}
        input(type="number" value="{sharedProps.atrophyPercent}" min="0" max="30" step="1" on:input!="{(e) => sharedProps.onAtrophyPercentChange?.(e.target.value)}")
        span % (chance to remove old stock on provision)
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
