<script>
  import { getContext } from 'svelte';
  import { getTextEditorAPI } from '~/src/helpers/utility.js';

  export let sharedProps = {};

  const doc = getContext('#doc');

  let rawDescription = '';
  let enrichedDescription = '';

  $: if ($doc) {
    rawDescription = $doc.getFlag('foundryvtt-shop-studio', 'description') ?? '';
    getTextEditorAPI().enrichHTML(rawDescription, { secrets: true }).then(html => {
      enrichedDescription = html;
    });
  }
function openActorSheet(actorId) {
    const actor = fromUuidSync(`Actor.${actorId}`);
    actor?.sheet?.render(true);
  }

  function onSocketTestClick() {
    game.socket.emit('module.foundryvtt-shop-studio', {
      type: 'ACTION',
      payload: 'Foo'
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
        //- button.socket-test-btn(type="button" on:click!="{onSocketTestClick}") Socket Test
        +if("sharedProps.associatedActors && sharedProps.associatedActors.length > 0")
          .associated-actors-section
            h2 {sharedProps.localize("AssociatedActors")}
            ul.associated-list
              +each("sharedProps.associatedActors as actorId")
                li.associated-entry
                  button.associated-link(type="button" data-tooltip="{sharedProps.getActorName(actorId)}" on:click!="{() => openActorSheet(actorId)}")
                    img.associated-img(
                      src="{game.actors.get(actorId)?.img || 'icons/svg/mystery-man.svg'}"
                      alt="{sharedProps.getActorName(actorId)}"
                    )
                    span.associated-name {sharedProps.getActorName(actorId)}
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

  .associated-actors-section
    background: color-mix(in srgb, var(--gas-tabs-content-background) 80%, transparent)
    border: 1px solid color-mix(in srgb, var(--gas-tab-inactive-border) 45%, transparent)
    border-radius: var(--border-radius)
    box-shadow: 0 0 0 1px var(--gas-li-inset) inset
    padding: var(--size-md)

    h2
      margin: 0 0 var(--size-sm)
      color: var(--gas-tab-active-color)
      border-bottom: 1px solid color-mix(in srgb, var(--gas-tab-active-indicator) 45%, transparent)
      padding-bottom: var(--size-xs)

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
    padding: 0.2rem 0.35rem
    min-height: 28px

  .associated-link
    display: flex
    align-items: center
    gap: 0.5rem
    flex: 1
    min-width: 0
    padding: 0
    border: 0
    background: transparent
    color: var(--gas-color-text)
    text-align: left
    cursor: pointer

    &:hover
      color: var(--gas-tab-active-color)
      background: color-mix(in srgb, var(--gas-tab-active-indicator) 10%, transparent)
      border-radius: 3px

  .associated-img
    width: 24px
    height: 24px
    object-fit: cover
    border-radius: 3px
    flex: 0 0 24px

  .associated-name
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap
    color: var(--gas-color-text)
</style>
