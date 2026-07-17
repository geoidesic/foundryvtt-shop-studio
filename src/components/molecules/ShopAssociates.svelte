<script>
  import { getContext } from 'svelte';
  import { MODULE_ID, MYSTERY_MAN } from '~/src/helpers/constants';
  import { localize } from '~/src/helpers/utility';

  const doc = getContext('#doc');

  let localList = [];

  $: localList = $doc ? [...getAssociatedActors()] : [];

  function getAssociatedActors() {
    const flagList = $doc?.getFlag?.(MODULE_ID, 'configuration')?.associatedActors;
    if (Array.isArray(flagList)) return flagList;
    return [];
  }

  async function handleRemove(index) {
    const updated = localList.filter((_, i) => i !== index);
    const configuration = $doc.getFlag?.(MODULE_ID, 'configuration') ?? {};
    await $doc.setFlag(MODULE_ID, 'configuration', {
      ...configuration,
      associatedActors: updated,
    });
  }

  function openSheet(entry) {
    const actor = game.actors.get(entry.id);
    actor?.sheet?.render(true);
  }
</script>

<template lang="pug">
  .shop-associates
    h2 {localize('AssociatedActors')}

    +if("localList.length > 0")
      ul.associated-list
        +each("localList as entry, index")
          li.associated-entry
            img.associated-entry__img(src="{entry.img || MYSTERY_MAN}" alt="{entry.name}" role="button" on:click!="{() => openSheet(entry)}" on:keypress!="{() => openSheet(entry)}")
            span.associated-entry__name(role="button" on:click!="{() => openSheet(entry)}" on:keypress!="{() => openSheet(entry)}") {entry.name}
            button.remove-btn(type="button" on:click!="{handleRemove(index)}") ×
      +else()
        p.no-items {localize('NoAssociatedActors')}
</template>

<style lang="sass">
  .shop-associates
    display: flex
    flex-direction: column
    gap: 0.5rem

    h2
      margin: 0

  .associated-list
    list-style: none
    margin: 0
    padding: 0
    display: flex
    flex-direction: column
    gap: 0.25rem

  .associated-entry
    display: flex
    align-items: center
    gap: 0.5rem
    padding: 0.25rem 0.5rem

    &:hover
      background: color-mix(in srgb, var(--gas-tab-active-indicator) 10%, transparent)
      border-radius: 3px

    &__img
      width: 28px
      height: 28px
      object-fit: cover
      border-radius: 3px
      cursor: pointer
      flex-shrink: 0

    &__name
      flex: 1
      cursor: pointer

      &:hover
        color: var(--gas-tab-active-color)

  .no-items
    margin: 0
    color: color-mix(in srgb, var(--gas-color-text) 50%, transparent)
    font-style: italic
    font-size: 0.9em

  .drag-hint--sub
    margin: 0.25rem 0 0
    text-align: center
    font-size: 0.8em
    color: color-mix(in srgb, var(--gas-color-text) 50%, transparent)

  .remove-btn
    background: none
    border: none
    color: var(--gas-color-text)
    cursor: pointer
    font-size: 1.1em
    opacity: 0.5
    padding: 0 0.25rem
    flex-shrink: 0

    &:hover
      opacity: 1
      color: var(--gas-color-negative)
</style>
