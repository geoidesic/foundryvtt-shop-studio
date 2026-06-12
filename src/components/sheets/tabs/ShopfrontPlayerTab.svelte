<script>
  import { getContext } from 'svelte';
  import { getTextEditorAPI } from '~/src/helpers/utility.js';

  export let sharedProps = {};

  const doc = getContext('#doc');

  let rawDescription = '';
  let enrichedDescription = '';

  $: if ($doc?.system?.description) {
    rawDescription = $doc.system.description;
    getTextEditorAPI().enrichHTML(rawDescription, { secrets: true }).then(html => {
      enrichedDescription = html;
    });
  }
</script>

<template lang="pug">
  .shopfront-player-tab
    .flexrow.gap-10
      .flex1.flexcol.gap-10
        img.profile-img(
          src="{sharedProps.actor?.img || 'icons/svg/mystery-man.svg'}"
          alt="Shop Profile"
        )
      .flex2
        .name-section
          h2 {sharedProps.localize("Name")}
          p.shop-name {sharedProps.actor?.name || ''}
        .description-section.mt-md
          h2 {sharedProps.localize("Description")}
          .description-content
            | {@html enrichedDescription}
</template>

<style lang="sass">
  @import "../../../styles/Mixins.sass"

  .shopfront-player-tab
    padding: var(--size-md)
    display: flex
    flex-direction: column

    .shop-name
      font-size: 1.2em
      font-weight: bold
      margin: 0
      color: var(--gas-color-text)

    .description-content
      p, ul, ol
        margin: 0.5em 0

      a
        color: var(--gas-tab-active-indicator)
        text-decoration: underline

      img
        max-width: 100%
        height: auto
        border-radius: 4px
</style>