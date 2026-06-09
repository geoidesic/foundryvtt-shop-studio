<script>
  export let sharedProps = {};
</script>

<template lang="pug">
  div.shopfront-tab
    div.shopfront-grid
      div.profile-section
        h2 {sharedProps.localize("ProfileImage")}
        img.profile-img(src="{sharedProps.actor?.img || 'icons/svg/mystery-man.svg'}" alt="Shop Profile")
        button(type="button" on:click!="{sharedProps.openImageEditor}")
          | Change Image
      div.description-section
        h2 {sharedProps.localize("Description")}
        textarea.description-text(value="{sharedProps.descriptionValue}" placeholder="Describe your shop..." on:input!="{(e) => sharedProps.onDescriptionChange?.(e.target.value)}")
      div.associated-actors-section
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
</template>
