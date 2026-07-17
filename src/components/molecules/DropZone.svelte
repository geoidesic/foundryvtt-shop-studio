<script>
  export let placeholder = 'Drop items here';
  export let acceptType = '';
  export let onDrop = () => {};

  let isDragOver = false;

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    isDragOver = true;
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;
  }

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;

    const textEditor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const data = textEditor.getDragEventData(e);
    await onDrop(data);
  }
</script>

<template lang="pug">
  .drag-drop-area(
    class="{isDragOver ? 'drag-over' : ''}"
    role="region"
    on:dragover|preventDefault|stopPropagation="{handleDragOver}"
    on:dragleave|preventDefault|stopPropagation="{handleDragLeave}"
    on:drop|preventDefault|stopPropagation="{handleDrop}"
  )
    slot
      p.drag-drop-area__placeholder {placeholder}
</template>

<style lang="sass">
  .drag-drop-area
    display: flex
    flex-direction: column
    gap: 0.5rem
    padding: 0.5rem
    border: 2px dashed color-mix(in srgb, var(--gas-tab-inactive-border) 45%, transparent)
    border-radius: var(--border-radius)
    min-height: 3rem
    transition: border-color 0.2s ease, background-color 0.2s ease

    &.drag-over
      border-color: var(--gas-tab-active-indicator)
      background-color: color-mix(in srgb, var(--gas-tab-active-indicator) 8%, transparent)

  .drag-drop-area__placeholder
    margin: 0
    color: color-mix(in srgb, var(--gas-color-text) 50%, transparent)
    font-style: italic
    font-size: 0.9em
    text-align: center
</style>