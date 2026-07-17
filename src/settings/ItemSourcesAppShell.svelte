<svelte:options accessors={true} />

<script>
  import { getContext } from 'svelte';
  import { TJSApplicationShell } from '@typhonjs-fvtt/runtime/svelte/component/application';
  import { MODULE_ID } from '~/src/helpers/constants';
  import { localize } from '~/src/helpers/utility';
  import {
    ITEM_SOURCES_SETTING,
    LISTABLE_ITEM_TYPES_SETTING,
    getAvailableItemTypes,
    getItemSourcePacks,
    getConfiguredListableItemTypes,
    autoAssignItemSources
  } from '~/src/helpers/itemSources';

  export let elementRoot;

  const { application } = getContext('#external');
  application.reactive.draggable = true;

  let searchText = '';
  let showOnlySelected = false;

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

  function handleSourceChange(collection, checked) {
    if (checked) {
      if (!selectedSources.includes(collection)) selectedSources = [...selectedSources, collection];
    } else {
      selectedSources = selectedSources.filter((source) => source !== collection);
    }
  }

  function handleTypeChange(type, checked) {
    if (checked) {
      if (!selectedTypes.includes(type)) selectedTypes = [...selectedTypes, type];
    } else {
      selectedTypes = selectedTypes.filter((entry) => entry !== type);
    }
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

<TJSApplicationShell bind:elementRoot>
  <main class="item-sources-settings">
    <header class="gss-sources-toolbar no-drag">
      <label class="gss-search-box">
        <i class="fas fa-search"></i>
        <input
          type="search"
          placeholder="{localize('ItemSources.SearchPlaceholder')}"
          value="{searchText}"
          on:input="{handleSearchInput}"
        />
      </label>

      <label class="gss-toggle-control">
        <input type="checkbox" bind:checked="{showOnlySelected}" />
        <span>{localize('ItemSources.ShowSelectedOnly')}</span>
      </label>
    </header>

    <section class="gss-sources-content">
      <details class="gss-source-section" open>
        <summary class="gss-source-summary">
          <span>{localize('ItemSources.ItemCompendia')}</span>
          <small>{selectedSources.length} / {sourceRows.length}</small>
        </summary>
        <div class="gss-source-actions">
          <button type="button" on:click="{handleSelectVisibleSources}">
            {localize('ItemSources.SelectVisible')}
          </button>
          <button type="button" on:click="{handleClearVisibleSources}">
            {localize('ItemSources.ClearVisible')}
          </button>
          <button type="button" on:click="{handleResetSources}">
            {localize('ItemSources.AutoAssign')}
          </button>
        </div>
        <div class="gss-source-list">
          {#if sourceRows.length === 0}
            <p class="gss-empty-state">{localize('ItemSources.NoItemCompendia')}</p>
          {:else if visibleSourceRows.length === 0}
            <p class="gss-empty-state">{localize('ItemSources.NoMatchesFilter')}</p>
          {/if}
          {#each visibleSourceRows as row}
            <div class="flexrow justify-vertical gap-1">
              <input
                type="checkbox"
                class="flex0"
                bind:checked="{row.checked}"
                on:change="{(e) => handleSourceChange(row.collection, e.currentTarget.checked)}"
              />
              <div class="flex3">{row.label}</div>
            </div>
          {/each}
        </div>
      </details>

      <details class="gss-source-section" open>
        <summary class="gss-source-summary">
          <span>{localize('ItemSources.ListableItemTypes')}</span>
          <small>{selectedTypes.length} / {allItemTypes.length}</small>
        </summary>
        <div class="gss-source-actions">
          <button type="button" on:click="{handleSelectAllTypes}">
            {localize('ItemSources.SelectAllTypes')}
          </button>
          <button type="button" on:click="{handleClearAllTypes}">
            {localize('ItemSources.ClearAllTypes')}
          </button>
          <button type="button" on:click="{handleResetTypes}">
            {localize('ItemSources.ResetTypes')}
          </button>
        </div>
        <div class="gss-source-list">
          {#if typeRows.length === 0}
            <p class="gss-empty-state">{localize('ItemSources.NoItemTypes')}</p>
          {/if}
          {#each typeRows as row}
            <div class="flexrow justify-vertical gap-1">
              <input
                class="flex0"
                type="checkbox"
                bind:checked="{row.checked}"
                on:change="{(e) => handleTypeChange(row.type, e.currentTarget.checked)}"
              />
              <div class="flex3">{row.label}</div>
            </div>
          {/each}
        </div>
      </details>
    </section>

    <footer class="gss-sources-footer">
      <button type="button" on:click="{handleCancel}">
        {localize('ItemSources.Cancel')}
      </button>
      <button type="button" class="gss-save-button" on:click="{handleSave}">
        {localize('ItemSources.Save')}
      </button>
    </footer>
  </main>
</TJSApplicationShell>

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
    padding: 0.75rem
    display: flex
    flex-direction: column
    gap: 0.5rem

  .gss-source-section
    border: 1px solid var(--gas-tab-inactive-border)
    border-radius: var(--border-radius)
    background: color-mix(in srgb, var(--gas-li-background) 70%, transparent)
    padding: 0.4rem 0.6rem 0.6rem

  .gss-source-summary
    display: flex
    align-items: center
    justify-content: space-between
    gap: var(--size-sm)
    cursor: pointer
    font-weight: 700

    small
      opacity: 0.75
      font-weight: 400

  .gss-source-actions
    display: flex
    flex-wrap: wrap
    gap: var(--size-xs)
    margin: 0.5rem 0

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
    padding: 2px 4px
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
      vertical-align: middle

    span
      flex: 1 1 auto
      min-width: 0
      cursor: pointer
      vertical-align: middle
      line-height: 1.25
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

  .gss-save-button
    min-width: 8rem
</style>
