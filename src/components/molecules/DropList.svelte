<script>
  import { getContext } from 'svelte';
  import DropZone from '~/src/components/molecules/DropZone.svelte';

  /**
   * Generic drop-zone list for any Foundry document type.
   *
   * Props:
   *   listPath      – dot-path to the array on the document (e.g. "system.configuration.rollTables")
   *   acceptType    – Foundry document type (e.g. "RollTable")
   *   placeholder   – drop zone hint text
   *   emptyText     – shown when list is empty
   *   resolveItem   – async (data) => resolved Document | null
   *   toEntry       – (resolved) => value to persist (can be an object or a plain string)
   *   entryKeyFn    – (entry) => unique key for dedup, defaults to entry.id (objects) or entry (strings)
   *   formatDisplay – (entry) => {img, name} for display; defaults to identity for objects, raw for strings
   */
  export let listPath = '';
  export let acceptType = '';
  export let placeholder = '';
  export let emptyText = '';
  export let resolveItem;
  export let toEntry;
  export let entryKeyFn;
  export let formatDisplay;

  const doc = getContext('#doc');

  let localList = [];

  $: if ($doc) {
    localList = [...(foundry.utils.getProperty($doc, listPath) || [])];
  }

  function defaultKeyFn(entry) {
    return typeof entry === 'string' ? entry : entry.id;
  }

  function defaultFormatter(entry) {
    if (typeof entry === 'string') {
      return { img: null, name: entry };
    }
    return { img: entry.img || null, name: entry.name || entry.id };
  }

  $: keyFn = entryKeyFn || defaultKeyFn;
  $: displayFn = formatDisplay || defaultFormatter;
  $: displayList = localList.map((e) => displayFn(e));

  async function handleDrop(data) {
    const resolved = await resolveItem(data);
    if (!resolved) {
      ui.notifications.warn(`Could not resolve ${acceptType} from drop.`);
      return;
    }

    const entry = toEntry(resolved);
    if (localList.some(e => keyFn(e) === keyFn(entry))) return;

    await persist([...localList, entry]);
  }

  async function handleRemove(index) {
    await persist(localList.filter((_, i) => i !== index));
  }

  async function persist(list) {
    const updateObj = {};
    foundry.utils.setProperty(updateObj, listPath, list);
    await $doc.update(updateObj);
  }
</script>

<template lang="pug">
  .drop-list-component
    DropZone(placeholder="{placeholder}" acceptType="{acceptType}" onDrop="{handleDrop}")

    +if("localList.length > 0")
      ul.drop-list
        +each("displayList as display, index")
          li.drop-list__entry
            +if("display.img")
              img.drop-list__img(src="{display.img}" alt="{display.name}")
            span.drop-list__name {display.name || index}
            button.remove-btn(type="button" on:click!="{handleRemove(index)}") ×
      +else()
        p.drop-list__empty {emptyText}
</template>

<style lang="sass">
  .drop-list-component
    display: flex
    flex-direction: column
    gap: 0.5rem

  .drop-list
    list-style: none
    margin: 0
    padding: 0
    display: flex
    flex-direction: column
    gap: 0.25rem

    &__entry
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
      flex-shrink: 0

    &__name
      flex: 1

    &__empty
      margin: 0
      color: color-mix(in srgb, var(--gas-color-text) 50%, transparent)
      font-style: italic
      font-size: 0.9em

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