<svelte:options accessors={true} />

<script>
  import { getContext } from 'svelte';
  import { TJSApplicationShell } from '@typhonjs-fvtt/runtime/svelte/component/application';
  import { MODULE_ID } from '~/src/helpers/constants';
  import { localize } from '~/src/helpers/utility';
  import {
    ITEM_SOURCES_SETTING,
    LISTABLE_ITEM_TYPES_SETTING,
    SHOW_SELECTED_ONLY_SETTING,
    getAvailableItemTypes,
    getItemSourcePacks,
    getConfiguredListableItemTypes,
    autoAssignItemSources
  } from '~/src/helpers/itemSources';

  export let elementRoot;

  const { application } = getContext('#external');
  application.reactive.draggable = true;

  let searchText = '';
  let showOnlySelected = game.settings.get(MODULE_ID, SHOW_SELECTED_ONLY_SETTING) === true;

  let sourcesOpen = true;
  let typesOpen = true;

  function toggleSources() {
    sourcesOpen = !sourcesOpen;
  }

  function toggleTypes() {
    typesOpen = !typesOpen;
  }

  function handleSummaryKeydown(event, toggle) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  }

  function getAllItemCompendia() {
    return game.packs?.filter((pack) => pack.documentName === 'Item') ?? [];
  }

  // Load the *currently saved* assignment so the UI reflects what is already configured.
  // We deliberately do NOT start with "all checked". The user (or Auto-assign) chooses.
  const savedSources = game.settings.get(MODULE_ID, ITEM_SOURCES_SETTING);
  let selectedSources = Array.isArray(savedSources)
    ? savedSources
    : (savedSources && Array.isArray(savedSources.items) ? savedSources.items : []);

  const initialAllTypes = getAvailableItemTypes();
  let allItemTypes = initialAllTypes;

  const savedTypes = game.settings.get(MODULE_ID, LISTABLE_ITEM_TYPES_SETTING);
  let selectedTypes = (savedTypes === null || savedTypes === undefined)
    ? initialAllTypes.map((t) => t.type)
    : (Array.isArray(savedTypes) ? savedTypes : []);

  // If nothing is selected yet, force the "show selected only" filter off so the user can see and pick from the full list.
  $: if (selectedSources.length === 0 && showOnlySelected) {
    showOnlySelected = false;
  }

  // Persist the "show selected only" toggle so it survives app reopenings.
  $: if (showOnlySelected !== undefined) {
    game.settings.set(MODULE_ID, SHOW_SELECTED_ONLY_SETTING, showOnlySelected === true);
  }

  // Explicit reactive dependencies so Svelte tracks changes reliably.
  $: selectedSourceSet = new Set(selectedSources);
  $: sourceRows = buildSourceRows(selectedSourceSet);
  // visibleSourceRows is used by the action buttons ("Select visible", "Clear visible") to know what the current filter/search would show.
  $: visibleSourceRows = sourceRows.filter((row) => {
    if (searchText && !row.searchable.includes(searchText)) return false;
    if (showOnlySelected && selectedSources.length > 0 && !row.checked) return false;
    return true;
  });

  $: selectedTypeSet = new Set(selectedTypes);
  $: typeRows = allItemTypes
    .map((type) => ({
      ...type,
      checked: selectedTypeSet.has(type.type)
    }))
    .filter((row) => !showOnlySelected || row.checked);

  function buildSourceRows(selectedSet) {
    const allCompendia = getAllItemCompendia();
    return allCompendia
      .map((pack) => ({
        collection: pack.collection,
        label: `${pack.metadata.label} [${pack.metadata.packageName}]`,
        searchable: `${pack.collection} ${pack.metadata.label} ${pack.metadata.packageName} ${pack.metadata.id}`.toLowerCase(),
        checked: selectedSet.has(pack.collection)
      }))
      .sort((a, b) => a.label.localeCompare(b.label, game.i18n?.lang));
  }

  function handleSearchInput(event) {
    searchText = (event.currentTarget?.value ?? '').toLowerCase().trim();
  }

  function handleShowSelectedOnlyChange(event) {
    showOnlySelected = event.currentTarget.checked === true;
  }

  function handleSourceChange(collection, checked) {
    if (checked) {
      if (!selectedSources.includes(collection)) selectedSources = [...selectedSources, collection];
    } else {
      selectedSources = selectedSources.filter((source) => source !== collection);
    }
  }

  function handleSourceInput(event) {
    handleSourceChange(event.currentTarget.dataset.collection, event.currentTarget.checked);
  }

  function handleTypeChange(type, checked) {
    if (checked) {
      if (!selectedTypes.includes(type)) selectedTypes = [...selectedTypes, type];
    } else {
      selectedTypes = selectedTypes.filter((entry) => entry !== type);
    }
  }

  function handleTypeInput(event) {
    handleTypeChange(event.currentTarget.dataset.type, event.currentTarget.checked);
  }

  function handleSelectVisibleSources() {
    const visibleCollections = new Set(visibleSourceRows.map((row) => row.collection));
    selectedSources = Array.from(new Set([
      ...selectedSources,
      ...visibleCollections
    ]));
  }

  function handleClearVisibleSources() {
    const visibleCollections = new Set(visibleSourceRows.map((row) => row.collection));
    selectedSources = selectedSources.filter((source) => !visibleCollections.has(source));
  }

  function handleResetSources() {
    selectedSources = autoAssignItemSources();
  }

  function handleResetTypes() {
    selectedTypes = allItemTypes.map((type) => type.type);
  }

  function handleSelectAllTypes() {
    selectedTypes = allItemTypes.map((type) => type.type);
  }

  function handleClearAllTypes() {
    selectedTypes = [];
  }

  async function handleSave() {
    await game.settings.set(MODULE_ID, ITEM_SOURCES_SETTING, selectedSources);
    await game.settings.set(MODULE_ID, LISTABLE_ITEM_TYPES_SETTING, selectedTypes.length === allItemTypes.length ? null : selectedTypes);
    application.close();
  }

  function handleCancel() {
    application.close();
  }
</script>

<template lang="pug">
  TJSApplicationShell(bind:elementRoot)
    main.item-sources-settings
      .no-drag.flexrow.gap-10.pa-sm.justify-flexrow-vertical
        .flex3
          label.gss-search-box.no-drag
            i.fas.fa-search
            input.no-drag(type="search" placeholder!="{localize('ItemSources.SearchPlaceholder')}" value="{searchText}" on:input!="{handleSearchInput}")
        .flex1
          label.gss-toggle-control.no-drag.flexrow.no-wrap
            .flex0
              input.no-drag(type="checkbox" checked!="{showOnlySelected}" on:change!="{handleShowSelectedOnlyChange}")
            .flex1
              span {localize('ItemSources.ShowSelectedOnly')}
      section.gss-sources-content
        .gss-source-section
          .gss-source-summary.gss-source-summary--button.no-drag(on:click!="{toggleSources}" role="button" tabindex="0" on:keydown!="{handleSummaryKeydown(event, toggleSources)}")
            i.gss-chevron(class:gss-chevron--open!="{sourcesOpen}")
            span {localize('ItemSources.ItemCompendia')}
            small {selectedSources.length} / {sourceRows.length}
          +if("sourcesOpen")
            .gss-source-actions.no-drag
              button.no-drag(type="button" on:click!="{handleSelectVisibleSources}") {localize('ItemSources.SelectVisible')}
              button.no-drag(type="button" on:click!="{handleClearVisibleSources}") {localize('ItemSources.ClearVisible')}
              button.no-drag(type="button" on:click!="{handleResetSources}") {localize('ItemSources.AutoAssign')}
            .gss-source-list
              +if("sourceRows.length === 0")
                p.gss-empty-state {localize('ItemSources.NoItemCompendia')}
                +else()
                  +if("visibleSourceRows.length === 0")
                    p.gss-empty-state {localize('ItemSources.NoMatchesFilter')}
              +each("visibleSourceRows as row")
                label.gss-source-row.no-drag.flexrow
                  .flex0
                    input.no-drag(type="checkbox" checked!="{row.checked}" on:change!="{handleSourceInput}" data-collection="{row.collection}")
                  .flex1
                    span.ml-xs {row.label}
        .gss-source-section
          .gss-source-summary.gss-source-summary--button.no-drag(on:click!="{toggleTypes}" role="button" tabindex="0" on:keydown!="{handleSummaryKeydown(event, toggleTypes)}")
            i.gss-chevron(class:gss-chevron--open!="{typesOpen}")
            span {localize('ItemSources.ListableItemTypes')}
            small {selectedTypes.length} / {allItemTypes.length}
          +if("typesOpen")
            p.gss-section-description {localize('ItemSources.ListableItemTypesDescription')}
            .gss-source-actions.no-drag
              button.no-drag(type="button" on:click!="{handleSelectAllTypes}") {localize('ItemSources.SelectAllTypes')}
              button.no-drag(type="button" on:click!="{handleClearAllTypes}") {localize('ItemSources.ClearAllTypes')}
              button.no-drag(type="button" on:click!="{handleResetTypes}") {localize('ItemSources.ResetTypes')}
            .gss-source-list
              +if("typeRows.length === 0")
                p.gss-empty-state {localize('ItemSources.NoItemTypes')}
              +each("typeRows as row")
                label.gss-source-row.no-drag.flexrow
                  .flex0
                    input.no-drag.mr-sm(type="checkbox" checked!="{row.checked}" on:change!="{handleTypeInput}" data-type="{row.type}")
                  .flex1.ml-xs
                    span {row.label}
      footer.gss-sources-footer.no-drag
        button.no-drag(type="button" on:click!="{handleCancel}") {localize('ItemSources.Cancel')}
        button.gss-save-button.no-drag(type="button" on:click!="{handleSave}") {localize('ItemSources.Save')}
</template>

<style lang="sass">
  :global(#foundryvtt-shop-studio-item-sources-settings .window-content)
    padding: 0
    overflow: hidden
    background: #000

  .item-sources-settings
    display: flex
    flex-direction: column
    height: 100%
    color: var(--gas-color-text)
    background: var(--gas-tabs-content-background)

  .gss-sources-toolbar
    display: flex
    align-items: center
    gap: var(--size-sm)
    padding: 0.75rem
    border-bottom: 1px solid var(--gas-tab-inactive-border)
    background: var(--gas-panel-1-background)

  .gss-search-box
    flex: 1
    display: flex
    align-items: center
    gap: 0.5rem
    min-width: 16rem

    i
      color: var(--gas-tab-active-color)

    input
      width: 100%

  .gss-toggle-control
    display: flex
    align-items: center
    gap: 0.35rem
    white-space: nowrap
    font-size: 0.9rem

    input
      margin: 0

  .gss-sources-content
    flex: 1
    overflow: auto
    padding: 0 0.75rem 0.75rem 0.75rem
    display: flex
    flex-direction: column
    gap: 0.5rem

  .gss-source-section
    border: 1px solid var(--gas-tab-inactive-border)
    border-radius: var(--border-radius)
    background: color-mix(in srgb, var(--gas-li-background) 40%, transparent)
    padding: 0.5rem 0.6rem 0.65rem

  .gss-source-summary
    display: flex
    align-items: center
    justify-content: space-between
    gap: var(--size-sm)
    cursor: pointer
    font-weight: 700

    &::marker
      color: var(--gas-tab-active-color)

    small
      opacity: 0.75
      font-weight: 400

  .gss-source-summary--button
    cursor: pointer
    user-select: none

    &:focus-visible
      outline: 1px solid var(--gas-tab-active-color)
      outline-offset: 2px

  .gss-chevron
    flex: 0 0 auto
    font-style: normal
    width: 1em
    text-align: center
    transition: transform 0.15s ease
    transform: rotate(-90deg)

    &::before
      content: "\f078"
      font-family: "Font Awesome 6 Free", "Font Awesome 6 Pro", "FontAwesome"
      font-weight: 900

    &.gss-chevron--open
      transform: rotate(0deg)

  .gss-source-actions
    display: flex
    align-items: center
    flex-wrap: wrap
    gap: var(--size-xs)
    margin: 0.5rem 0

    button
      margin: 0

  .gss-section-description
    margin: 0.45rem 0 0
    color: var(--color-text-secondary, var(--gas-color-text))
    font-size: 0.9rem
    line-height: 1.35
    opacity: 0.85

  .gss-source-list
    display: flex
    flex-direction: column
    gap: 0
    margin-top: 0

  .gss-source-row
    display: flex
    align-items: center
    gap: 6px
    cursor: pointer
    min-height: 1.7rem
    padding: 0.2rem 0.35rem
    margin: 0
    width: 100%
    box-sizing: border-box
    color: var(--gas-color-text, var(--color-text-primary, #f0f0f0))

    input
      margin: 0
      padding: 0
      flex: 0 0 auto
      width: 14px
      height: 14px
      cursor: pointer

    span
      flex: 1 1 auto
      min-width: 0
      cursor: pointer
      line-height: 1.35
      white-space: normal
      overflow: visible
      word-break: break-word
      font-size: 0.95em
      color: inherit

  .gss-empty-state
    margin: 0
    padding: 0.75rem
    opacity: 0.8
    border-radius: var(--border-radius)
    background: color-mix(in srgb, var(--gas-li-background) 50%, transparent)

  .gss-sources-footer
    display: flex
    justify-content: flex-end
    gap: var(--size-sm)
    padding: 0.75rem
    border-top: 1px solid var(--gas-tab-inactive-border)
    background: var(--gas-panel-1-background)
    pointer-events: none

    button
      pointer-events: auto

  .gss-save-button
    min-width: 8rem
</style>
