<script>
  import ProseMirror from '~/src/components/molecules/ProseMirror.svelte';

  export let sharedProps = {};
</script>

<template lang="pug">
  
  .shopfront-tab
    .flexrow.gap-10
      .flex1.flexcol.gap-10
        .profile-section.flex1
          h2 {sharedProps.localize("ProfileImage")}
          img.profile-img(src="{sharedProps.actor?.img || 'icons/svg/mystery-man.svg'}" alt="Shop Profile")
          button(type="button" on:click!="{sharedProps.openImageEditor}")
            | Change Image
      
        .associated-actors-section.flex2
          h2 {sharedProps.localize("AssociatedActors")}
          div.drag-drop-area(role="region" aria-label="Associated actors drop zone" on:dragover|preventDefault="{sharedProps.handleDragOver}" on:drop|preventDefault="{sharedProps.handleActorDrop}")
            p.drag-hint {sharedProps.localize("DragActorsHere")}
            p.small (Drag actor tokens or from actor directory)
          +if("sharedProps.associatedActors && sharedProps.associatedActors.length > 0")
            ul.associated-list
              +each("sharedProps.associatedActors as assoc, index")
                li
                  span {sharedProps.getActorName(assoc)}
                  button.remove-btn(type="button" on:click!="{() => sharedProps.removeAssociated(index)}") ×
            +else()
              p.no-items No associated actors yet.
      .flex2
        .description-section
          h2 {sharedProps.localize("Description")}
          ProseMirror(attr="system.details.description" classes="shop-description-editor")
        
</template>
