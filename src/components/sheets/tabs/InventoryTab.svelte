<script>
  import { getContext, onMount } from 'svelte';
  import { TJSDocument } from '#runtime/svelte/store/fvtt/document';
  import { rippleFocus } from '#standard/action/animate/composable';
  import { TJSInput } from '#standard/component/form';
  import { createFilterQuery } from '~/src/filters/itemFilterQuery';
  import InventoryRow from '~/src/components/molecules/InventoryRow.svelte';

  export let sharedProps = {};

  const Actor = getContext('#doc');
  const doc = new TJSDocument($Actor);
  const nameSearch = createFilterQuery('name');
  const input = {
    store: nameSearch,
    efx: rippleFocus(),
    placeholder: 'foundryvtt-shop-studio.FilterInventory',
    type: 'search',
    id: 'inventory-search',
  };

  $: input.placeholder = 'foundryvtt-shop-studio.FilterInventory';

  $: if (sharedProps.filterText !== nameSearch.keyword) {
    nameSearch.set(sharedProps.filterText || '');
  }

  const inventory = doc.embedded.create(Item, {
    name: 'inventory',
    filters: [nameSearch],
    sort: (a, b) => a.name.localeCompare(b.name),
  });

  $: items = [...inventory];

  function showItemSheet(item) {
    item.sheet?.render(true);
  }

  function handleItemKeydown(item, event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showItemSheet(item);
    }
  }

  onMount(() => {
    const unsubscribe = nameSearch.subscribe((value) => {
      if (sharedProps.filterText !== value) {
        sharedProps.onFilterChange?.(value);
      }
    });

    return unsubscribe;
  });
</script>

<template lang="pug">
  div.inventory-tab
    div.inventory-controls
      TJSInput({input})
      button(type="button" on:click!="{sharedProps.clearFilter}") {sharedProps.localize('ClearFilter')}
    div.inventory-list
      table.borderless
        thead
          tr.gold
            th.img.shrink(scope="col")
            th.left.expand(scope="col") {sharedProps.localize('Name')}
            th.fixed(scope="col") {sharedProps.localize('Quantity')}
        tbody
          +each("items as item, index")
            InventoryRow(rowClass="inventory-item")
              svelte:fragment(slot="c1")
                img.icon(src="{item.img || 'icons/svg/mystery-man.svg'}" alt="{item.name}")
              svelte:fragment(slot="c2")
                a.stealth.link(href="#" on:click|preventDefault="{showItemSheet(item)}" on:keydown|preventDefault|stopPropagation!="{(e) => handleItemKeydown(item, e)}" tabindex="0" role="button") {item.name}
              svelte:fragment(slot="c3")
                span.quantity {item.system?.quantity ?? 0}
</template>

<style lang="sass">
  @import "../../../styles/Mixins.sass"

  .inventory-tab
    @include flex-column
    gap: var(--size-sm)
    min-height: 0

  .inventory-controls
    @include flex-row
    gap: var(--size-sm)
    align-items: center

  .inventory-list
    min-height: 0
    overflow: auto

  .icon
    width: 2rem
    height: 2rem
    object-fit: cover
    border-radius: var(--border-radius)

  .quantity
    text-align: center
</style>

