<svelte:options accessors={true} />

<script>
  import { getContext, onDestroy, onMount, setContext } from 'svelte';
  import { ApplicationShell } from '#runtime/svelte/component/application';
  import ShopSheetGM from '~/src/components/sheets/ShopSheetGM.svelte';
  import ShopSheetPlayer from '~/src/components/sheets/ShopSheetPlayer.svelte';
  import { observeFoundryBodyTheme } from '~/src/helpers/syncAppThemeFromFoundryBody';
  import { MODULE_ID } from '~/src/helpers/constants';
  import { registerShopDocumentStore } from '~/src/helpers/shopSocket.js';
  import { shopTelemetry } from '~/src/helpers/telemetry.js';
  import { isShopEditing } from '~/src/helpers/shopIdentity.js';

  export let elementRoot;
  export let documentStore;
  export let document = void 0;

  setContext('#doc', documentStore);
  const application = getContext('#external').application;

  let disconnectFoundryTheme = () => {};
  let unregisterShopDocumentStore = () => {};
  let registeredShopUuid = null;

  $: actor = $documentStore;
  $: isEditing = isShopEditing(actor);
  $: showGM = game.user?.isGM && isEditing;

  /** The actor ID the current player has selected as their shop target. */
  $: targetActorId = ($documentStore)
    ? $documentStore.getFlag(MODULE_ID, `targetActor.${game.user.id}`) ?? null
    : null;

  $: {
    const shopUuid = $documentStore?.uuid ?? null;
    if (shopUuid !== registeredShopUuid) {
      shopTelemetry('ShopSheet', 'document store registration changed', {
        previousShopUuid: registeredShopUuid,
        nextShopUuid: shopUuid,
        actorId: $documentStore?.id,
        actorName: $documentStore?.name,
        isEditing,
        showGM,
      });
      unregisterShopDocumentStore();
      registeredShopUuid = shopUuid;
      unregisterShopDocumentStore = shopUuid
        ? registerShopDocumentStore(shopUuid, documentStore)
        : () => {};
    }
  }

  onMount(() => {
    shopTelemetry('ShopSheet', 'mounted', {
      actorId: $documentStore?.id,
      actorUuid: $documentStore?.uuid,
      actorName: $documentStore?.name,
      isEditing,
      showGM,
      targetActorId,
    });
    disconnectFoundryTheme = observeFoundryBodyTheme(elementRoot);
    application.reactive.draggable = true;
  });

  onDestroy(() => {
    shopTelemetry('ShopSheet', 'destroyed', {
      registeredShopUuid,
      actorId: $documentStore?.id,
      actorUuid: $documentStore?.uuid,
    });
    unregisterShopDocumentStore();
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
