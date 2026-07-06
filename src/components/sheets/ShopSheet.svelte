<svelte:options accessors={true} />

<script>
  import { getContext, onDestroy, onMount, setContext } from 'svelte';
  import { ApplicationShell } from '#runtime/svelte/component/application';
  import ShopSheetGM from '~/src/components/sheets/ShopSheetGM.svelte';
  import ShopSheetPlayer from '~/src/components/sheets/ShopSheetPlayer.svelte';
  import { observeFoundryBodyTheme } from '~/src/helpers/syncAppThemeFromFoundryBody';
  import { MODULE_ID } from '~/src/helpers/constants';

  export let elementRoot;
  export let documentStore;
  export let document = void 0;

  setContext('#doc', documentStore);
  const application = getContext('#external').application;

  let disconnectFoundryTheme = () => {};

  $: actor = $documentStore;
  $: isEditing = actor?.system?.identity?.isEditing ?? false;
  $: showGM = game.user?.isGM && isEditing;

  /** The actor ID the current player has selected as their shop target. */
  $: targetActorId = ($documentStore)
    ? $documentStore.getFlag(MODULE_ID, `targetActor.${game.user.id}`) ?? null
    : null;

  onMount(() => {
    disconnectFoundryTheme = observeFoundryBodyTheme(elementRoot);
    application.reactive.draggable = true;
  });

  onDestroy(() => {
    disconnectFoundryTheme();
  });
</script>

<template lang="pug">
  ApplicationShell(bind:elementRoot)
    +if("showGM")
      ShopSheetGM({documentStore})
      +else()
        ShopSheetPlayer({documentStore} bind:targetActorId)
</template>
