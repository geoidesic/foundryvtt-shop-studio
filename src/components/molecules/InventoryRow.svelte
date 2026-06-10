<script>
  export let rowClass = '';
</script>

<template lang="pug">
  li(class="{rowClass} flexrow justify-vertical standard-list-row")
    slot(name="c1")
    .flex4.left
      slot(name="c2")
    .flex2
      slot(name="c3")
    +if("$$slots.c4")
      .flex2
        slot(name="c4")
    +if("$$slots.c5")
      .actions.flex.right
        slot(name="c5")
</template>

<style lang="sass">
  .flexrow
    gap: var(--size-xs)

  .standard-list-row
    align-items: center
    padding: var(--size-xs) 0

    &:not(:last-child)
      border-bottom: 1px solid color-mix(in srgb, var(--gas-tab-inactive-border) 45%, transparent)

  .actions
    margin-left: var(--size-sm)
    margin-right: 0
    justify-content: right

    :not(:last-child)
      margin-right: 2px
</style>

