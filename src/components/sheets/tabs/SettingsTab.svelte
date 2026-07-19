<script>
  import { getContext } from 'svelte';
  import DropZone from '~/src/components/molecules/DropZone.svelte';
  import { shopConfig } from '~/src/stores/shopConfig.js';
  import { getConfiguredListableItemTypes } from '~/src/helpers/itemSources';
  import { getSystemCurrencies, getCurrencyLabel } from '~/src/helpers/currency.js';
  import { getVendorFunds, setVendorFunds } from '~/src/helpers/shopIdentity.js';
  import { MODULE_ID } from '~/src/helpers/constants.ts';

  export let sharedProps = {};

  // Get the shopConfig store from context (set by ShopSheetGM)
  const config = getContext('shopConfig') || shopConfig;

  let rollTables = [];
  let rollTableRolls = [];
  let provisionMode = 'rolltable';
  let compendiumProvision = [];

  $: rollTables = Array.isArray($config.rollTables) ? $config.rollTables : [];
  $: rollTableRolls = normalizeRollTableRolls(rollTables, $config.rollTableRolls);
  $: syncRollTableRolls(rollTables, rollTableRolls, $config.rollTableRolls);
  $: provisionMode = $config.provisionMode ?? 'rolltable';
  $: compendiumProvision = Array.isArray($config.compendiumProvision) ? $config.compendiumProvision : [];

  // Collapsible state
  let pricingOpen = true;
  let provisioningOpen = true;

  $: listableTypes = getConfiguredListableItemTypes();

  // Ensure every listable type has a compendium provision entry (default quantity 0).
  $: compendiumRows = listableTypes.map((type) => {
    const existing = compendiumProvision.find((entry) => entry.type === type.type);
    return {
      type: type.type,
      label: type.label,
      quantity: existing ? Number(existing.quantity ?? 0) : 0,
    };
  });

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

  function toggleProvisionMode() {
    const next = provisionMode === 'compendium' ? 'rolltable' : 'compendium';
    config.update((current) => ({ ...current, provisionMode: next }));
    sharedProps.onProvisionModeChange?.(next);
    sharedProps.silentSaveSettings?.();
  }

  async function setCompendiumQuantity(type, value) {
    const quantity = Math.max(0, Number.parseInt(value, 10) || 0);
    const next = compendiumProvision.filter((entry) => entry.type !== type);
    if (quantity > 0) next.push({ type, quantity });
    config.update((current) => ({ ...current, compendiumProvision: next }));
    sharedProps.onCompendiumProvisionChange?.(next);
    await sharedProps.silentSaveSettings?.();
  }

  function handleCompendiumQuantityInput(event) {
    setCompendiumQuantity(event.currentTarget.dataset.type, event.currentTarget.value);
  }

  function handleCompendiumQuantityStep(event) {
    const type = event.currentTarget.dataset.type;
    const delta = Number(event.currentTarget.dataset.delta);
    const current = compendiumRows.find((row) => row.type === type)?.quantity ?? 0;
    setCompendiumQuantity(type, current + delta);
  }

  // ── Vendor funds editor ──
  let vendorFundsOpen = false;
  let vendorFundsDraft = {};
  let vendorFundsDirty = false;

  $: currencyDenominations = Object.keys(getSystemCurrencies());

  // Reactively mirror the shop's live vendor funds into the edit draft so credits
  // from purchases (and other external changes) are reflected without a manual
  // reload. Skipped while the GM has unsaved edits in progress.
  $: vendorFundsLive = sharedProps.actor ? getVendorFunds(sharedProps.actor) : {};
  $: if (sharedProps.actor && currencyDenominations.length > 0 && !vendorFundsDirty) {
    const next = {};
    for (const denom of currencyDenominations) {
      next[denom] = Number(vendorFundsLive?.[denom] ?? 0);
    }
    if (JSON.stringify(next) !== JSON.stringify(vendorFundsDraft)) {
      vendorFundsDraft = next;
    }
  }

  async function saveVendorFunds() {
    const actor = sharedProps.actor;
    if (!actor) return;
    const nextFunds = {};
    for (const denom of currencyDenominations) {
      const value = Math.max(0, Number(vendorFundsDraft[denom] ?? 0));
      if (value > 0) nextFunds[denom] = value;
    }
    await setVendorFunds(actor, nextFunds);
    await sharedProps.silentSaveSettings?.();
    vendorFundsDirty = false;
    ui.notifications.info(sharedProps.localize('VendorFunds') + ' saved');
  }

  function onVendorFundInput(event) {
    const denom = event.currentTarget.dataset.denom;
    vendorFundsDraft[denom] = Number(event.currentTarget.value ?? 0);
    vendorFundsDirty = true;
  }

  function onVendorFundStep(event) {
    const denom = event.currentTarget.dataset.denom;
    const delta = Number(event.currentTarget.dataset.delta);
    vendorFundsDraft[denom] = Math.max(0, (Number(vendorFundsDraft[denom] ?? 0)) + delta);
    vendorFundsDirty = true;
  }
</script>

<template lang="pug">
  div.settings-tab
    div.settings-form.ma-lg
      //- Pricing collapsible
      section.settings-collapsible
        div.settings-collapsible__summary.no-drag(on:click!="{() => pricingOpen = !pricingOpen}" role="button" tabindex="0" on:keydown!="{e => (e.key === 'Enter' || e.key === ' ') && (pricingOpen = !pricingOpen)}")
          i.fas.fa-chevron-down.settings-collapsible__chevron(class:settings-collapsible__chevron--open!="{pricingOpen}")
          h2 {sharedProps.localize("Pricing")}
        +if("pricingOpen")
          div.settings-collapsible__body
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

      //- Vendor funds collapsible (peer of Pricing)
      section.settings-collapsible
        div.settings-collapsible__summary.no-drag(on:click!="{() => vendorFundsOpen = !vendorFundsOpen}" role="button" tabindex="0" on:keydown!="{e => (e.key === 'Enter' || e.key === ' ') && (vendorFundsOpen = !vendorFundsOpen)}")
          i.fas.fa-chevron-down.settings-collapsible__chevron(class:settings-collapsible__chevron--open!="{vendorFundsOpen}")
          h2 {sharedProps.localize("VendorFunds")}
        +if("vendorFundsOpen")
          div.settings-collapsible__body
            p.setting-help {sharedProps.localize("VendorFundsHelp")}
            div.flexrow.gap-4
              +each("currencyDenominations as denom")
                .flex1
                  .flexrow
                    .flex3
                      span.vendor-fund-label {getCurrencyLabel(denom)}
                      input.vendor-fund-input(type="number" min="0" step="1" data-denom!="{denom}" value!="{vendorFundsDraft[denom] ?? 0}" on:input!="{onVendorFundInput}")

                    .flex1
                      .flexcol
                        .flex1
                          button.stealth.qty-btn(type="button" data-denom!="{denom}" data-delta="1" on:click!="{onVendorFundStep}" data-tooltip="{sharedProps.localize('Increase')}")
                            i.fa.fa-chevron-up
                        .flex1
                          button.stealth.qty-btn(type="button" data-denom!="{denom}" data-delta="-1" on:click!="{onVendorFundStep}" data-tooltip="{sharedProps.localize('Decrease')}")
                            i.fa.fa-chevron-down
            button.glossy-button.gold-light.hover-shine(type="button" on:click!="{saveVendorFunds}") {sharedProps.localize("Save") || 'Save'}

      //- Provisioning collapsible
      section.settings-collapsible
        div.settings-collapsible__summary.no-drag(on:click!="{() => provisioningOpen = !provisioningOpen}" role="button" tabindex="0" on:keydown!="{e => (e.key === 'Enter' || e.key === ' ') && (provisioningOpen = !provisioningOpen)}")
          i.fas.fa-chevron-down.settings-collapsible__chevron(class:settings-collapsible__chevron--open!="{provisioningOpen}")
          h2 {sharedProps.localize("Provisioning")}
        +if("provisioningOpen")
          div.settings-collapsible__body
            div.provision-mode-toggle
              button.provision-mode-toggle__btn(type="button" class:active!="{provisionMode === 'compendium'}" on:click!="{toggleProvisionMode}" data-tooltip!="{sharedProps.localize('ProvisionModeTooltip')}")
                i.fas(class:fa-toggle-on!="{provisionMode === 'compendium'}" class:fa-toggle-off!="{provisionMode !== 'compendium'}")
                span.provision-mode-toggle__label {provisionMode === 'compendium' ? sharedProps.localize('ProvisionByCompendium') : sharedProps.localize('ProvisionByRollTable')}

            +if("provisionMode === 'rolltable'")
              div.rolltables-section
                h3 {sharedProps.localize("RollTables")} ({rollTables.length})
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

            +if("provisionMode === 'compendium'")
              div.compendium-provision-section
                p.compendium-provision-hint {sharedProps.localize("CompendiumProvisionHint")}
                +if("compendiumRows.length > 0")
                  ul.compendium-provision__list
                    +each("compendiumRows as row")
                      li.compendium-provision__entry
                        span.compendium-provision__name {row.label}
                        div.compendium-provision__rolls
                          button.compendium-provision__step(type="button" data-type="{row.type}" data-delta="-1" data-tooltip="{sharedProps.localize('Decrease')}" on:click!="{handleCompendiumQuantityStep}")
                            i.fa.fa-minus
                          input.compendium-provision__count(type="number" min="0" step="1" data-type="{row.type}" value="{row.quantity}" aria-label="{sharedProps.localize('Quantity')}" on:input!="{handleCompendiumQuantityInput}")
                          button.compendium-provision__step(type="button" data-type="{row.type}" data-delta="1" data-tooltip="{sharedProps.localize('Increase')}" on:click!="{handleCompendiumQuantityStep}")
                            i.fa.fa-plus
                +if("compendiumRows.length === 0")
                  p.compendium-provision__empty {sharedProps.localize("NoListableTypes")}

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

  .settings-collapsible
    border: 1px solid var(--gas-tab-inactive-border)
    border-radius: var(--border-radius)
    background: color-mix(in srgb, var(--gas-li-background) 40%, transparent)
    overflow: hidden

  .settings-collapsible__summary
    display: flex
    align-items: center
    gap: 0.5rem
    padding: 0.6rem 0.75rem
    cursor: pointer
    user-select: none

    &:focus-visible
      outline: 1px solid var(--gas-tab-active-color)
      outline-offset: -1px

    h2
      margin: 0
      font-size: 1.05rem

  .settings-collapsible__chevron
    flex: 0 0 auto
    transition: transform 0.15s ease
    transform: rotate(-90deg)

    &.settings-collapsible__chevron--open
      transform: rotate(0deg)

  .settings-collapsible__body
    display: flex
    flex-direction: column
    gap: 1rem
    padding: 0 0.75rem 0.85rem

  .provision-mode-toggle
    display: flex
    flex-wrap: wrap
    gap: 1rem
    padding: 0.5rem 0
    border-bottom: 1px solid var(--gas-tab-inactive-border)

  .provision-mode-toggle__btn
    display: inline-flex
    align-items: center
    gap: 0.5rem
    padding: 0.3rem 0.6rem
    border: 1px solid var(--gas-tab-inactive-border)
    border-radius: var(--border-radius)
    background: color-mix(in srgb, var(--gas-li-background) 40%, transparent)
    color: var(--gas-color-text)
    cursor: pointer
    font-size: 0.9rem

    i
      font-size: 1.1rem

    &.active
      color: var(--gas-tab-active-color)
      border-color: var(--gas-tab-active-color)

      i
        color: var(--gas-tab-active-color)

    &:hover
      border-color: var(--gas-tab-active-color)

  .provision-mode-toggle__label
    white-space: nowrap

  .rolltables-section
    display: flex
    flex-direction: column
    gap: 0.5rem

    h3
      margin: 0

    :global(.drag-drop-area)
      display: flex
      flex-direction: column
      gap: 0.5rem

  .compendium-provision-section
    display: flex
    flex-direction: column
    gap: 0.5rem

  .compendium-provision-hint
    margin: 0
    opacity: 0.8
    font-size: 0.9em

  .compendium-provision__list
    list-style: none
    margin: 0
    padding: 0
    display: flex
    flex-direction: column
    gap: 0.25rem

  .compendium-provision__entry
    display: flex
    align-items: center
    gap: 0.4rem
    min-height: 32px

  .compendium-provision__name
    flex: 1
    min-width: 0
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

  .compendium-provision__rolls
    flex: 0 0 auto
    display: inline-grid
    grid-template-columns: 22px 42px 22px
    align-items: center
    gap: 2px
    margin-left: 0.5rem

  .compendium-provision__step
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

  .compendium-provision__count
    width: 42px
    height: 22px
    min-width: 0
    padding: 0 0.25rem
    text-align: center
    font-size: 0.8rem

  .compendium-provision__empty
    margin: 0
    color: color-mix(in srgb, var(--gas-color-text) 50%, transparent)
    font-style: italic
    font-size: 0.9em

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

  // ── Vendor funds grid ──
  .vendor-funds-grid
    display: flex
    flex-wrap: wrap
    gap: 0.75rem
    align-items: flex-end

  .vendor-fund-cell
    display: flex
    flex-direction: column
    align-items: center
    gap: 0.25rem
    min-width: 64px

  .vendor-fund-label
    font-size: 0.75rem
    font-weight: 600
    text-transform: uppercase
    letter-spacing: 0.04em
    opacity: 0.8

  .vendor-fund-stepper
    display: flex
    flex-direction: column
    align-items: center
    gap: 1px

  .vendor-fund-stepper .qty-btn
    width: 22px
    height: 16px
    display: inline-flex
    align-items: center
    justify-content: center
    padding: 0
    border: 0
    border-radius: 3px
    background: color-mix(in srgb, var(--gas-color-text) 10%, transparent)
    color: var(--gas-color-text)
    cursor: pointer
    font-size: 0.6rem
    line-height: 1

    &:hover
      background: color-mix(in srgb, var(--gas-tab-active-indicator) 20%, transparent)
      color: var(--gas-tab-active-color)

  .vendor-fund-input
    width: 64px
    height: 24px
    min-width: 0
    padding: 0 0.25rem
    text-align: center
    font-size: 0.85rem

  :global(.actions)
    justify-content: flex-start
    flex-wrap: wrap
</style>
