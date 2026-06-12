<script>
  import ProseMirror from '~/src/components/molecules/ProseMirror.svelte';

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
</script>

<template lang="pug">
  
  .shopfront-tab
    .flexrow.gap-10
      .flex1.flexcol.gap-10
        .profile-section.flex1
          img.profile-img(on:click!="{sharedProps.openImageEditor}" src="{sharedProps.actor?.img || 'icons/svg/mystery-man.svg'}" alt="Shop Profile")
          
        .associated-actors-section.flex2
          h2 {sharedProps.localize("AssociatedActors")}
          div.drag-drop-area(role="region" aria-label="Associated actors drop zone" on:dragover|preventDefault="{sharedProps.handleDragOver}" on:drop|preventDefault="{sharedProps.handleActorDrop}")
            p.drag-hint {sharedProps.localize("DragActorsHere")}
            p.small {sharedProps.localize('DragActorTokensHint')}
          +if("sharedProps.associatedActors && sharedProps.associatedActors.length > 0")
            ul.associated-list
              +each("sharedProps.associatedActors as assoc, index")
                li
                  span {sharedProps.getActorName(assoc)}
                  button.remove-btn(type="button" on:click!="{() => sharedProps.removeAssociated(index)}") ×
            +else()
              p.no-items {sharedProps.localize('NoAssociatedActors')}
      .flex2
        .name-section
          h2 {sharedProps.localize("Name")}
          input.name-input(type="text" value="{sharedProps.actor?.name || ''}" on:change!="{e => sharedProps.actor?.update({name: e.target.value})}" placeholder!="{sharedProps.localize('ShopNamePlaceholder')}")
        .description-section
          h2 {sharedProps.localize("Description")}
          ProseMirror(
            classes="{proseMirrorClasses}" 
            attr="system.description" 
            on:editor:save="{handleEditorSave}"
            on:editor:start="{handleEditorStart}"
            on:editor:cancel="{handleEditorCancel}"
          )
        
</template>
<style lang="sass">

</style>