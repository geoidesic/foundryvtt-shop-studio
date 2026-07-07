<script>
  import ProseMirror from '~/src/components/molecules/ProseMirror.svelte';
  import ActorBucket from '~/src/components/molecules/ActorBucket.svelte';

  export let sharedProps = {};
  const proseMirrorClasses = ['left', 'small']

  // Debug: Log when editor events occur
  function handleEditorSave(event) {
    console.log("ShopfrontTab: editor:save", event.detail);
  }
  function handleEditorStart() {
    console.log("ShopfrontTab: editor:start");
  }
  function handleEditorCancel() {
    console.log("ShopfrontTab: editor:cancel");
  }

  async function onActorsPersist(list) {
    // Convert ActorBucket's object entries to string IDs for system storage
    sharedProps.onAssociatedActorsChange(list.map(e => e.id));
    await sharedProps.silentSaveSettings();
  }
</script>

<template lang="pug">
  
  .shopfront-tab
    .flexrow.gap-10.pa-md
      .flex1.flexcol.gap-10
        img.profile-img(on:click!="{sharedProps.openImageEditor}" src="{sharedProps.actor?.img || 'icons/svg/mystery-man.svg'}" alt="Shop Profile")
          
        .associated-actors-section.flex2
          ActorBucket(
            listPath="flags.shop-studio.configuration.associatedActors"
            isEditing="{sharedProps.isEditing}"
            onPersist="{onActorsPersist}"
          )
      .flex2.ml-sm
        .name-section
          h2 {sharedProps.localize("Name")}
          input.name-input(type="text" value="{sharedProps.actor?.name || ''}" on:change!="{e => sharedProps.actor?.update({name: e.target.value})}" placeholder!="{sharedProps.localize('ShopNamePlaceholder')}")
        .description-section.mt-md
          h2 {sharedProps.localize("Description")}
          ProseMirror(
            classes="{proseMirrorClasses}" 
            attr="flags.foundryvtt-shop-studio.description" 
            on:editor:save="{handleEditorSave}"
            on:editor:start="{handleEditorStart}"
            on:editor:cancel="{handleEditorCancel}"
          )
        
</template>
<style lang="sass">

</style>
