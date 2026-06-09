<script>
  export let sharedProps = {};
</script>

<template lang="pug">
  div.inventory-tab
    div.inventory-controls
      input.filter-input(type="text" value="{sharedProps.filterText}" on:input!="{(e) => sharedProps.onFilterChange?.(e.target.value)}" placeholder="{sharedProps.localize('FilterInventory')}")
      button(type="button" on:click!="{sharedProps.clearFilter}") Clear
    div.inventory-list
      +each("sharedProps.items || [] as item")
        +if("!sharedProps.filterText || (item.name && item.name.toLowerCase().includes(sharedProps.filterText.toLowerCase()))")
          div.inventory-item
            span.item-name {item.name}
            span.item-price ${sharedProps.calculatePrice(item.system?.price?.value || item.system?.price || 0)} gp
            button(type="button" on:click!="{() => sharedProps.openItemSheet(item)}") View
</template>
