<script>
  import { getContext } from 'svelte';
  import DropZone from '~/src/components/molecules/DropZone.svelte';
  import { MODULE_ID, MYSTERY_MAN } from '~/src/helpers/constants';
  import { localize } from '~/src/helpers/utility';

  export let listPath = 'flags.shop-studio.configuration.associatedActors';
  export let placeholder = localize('DragActorsHere');
  export let emptyText = localize('NoAssociatedActors');
  export let isEditing = false;
  /** Optional external persist callback. Called with (newList) instead of internal flag-based persist. */
  export let onPersist = null;

  const doc = getContext('#doc');

  let localList = [];

  function telemetry(stage, payload = {}) {
    window.GAS?.log?.g?.(`GSS:ActorBucket:${stage}`, {
      docId: $doc?.id,
      docUuid: $doc?.uuid,
      listPath,
      ...payload,
    });
  }

  $: localList = $doc ? [...getAssociatedActors()] : [];
  $: if ($doc) {
    telemetry('state', {
      flags: $doc.getFlag?.(MODULE_ID, 'configuration')?.associatedActors,
      localList,
      localCount: localList.length,
    });
  }

  function getAssociatedActors() {
    const flagList = $doc.getFlag?.(MODULE_ID, 'configuration')?.associatedActors;
    telemetry('read-flags', {
      count: Array.isArray(flagList) ? flagList.length : null,
      flagList,
    });
    if (!Array.isArray(flagList)) return [];

    return flagList
      .map((id) => {
        if (typeof id === 'object' && id !== null) return id;
        const actor = game.actors.get(id);
        return actor ? actorToEntry(actor) : null;
      })
      .filter(Boolean);
  }

  async function resolveActor(data) {
    telemetry('resolve-start', { data });
    if (!data) return null;

    if (data.type === 'Token') {
      if (data.actorUuid) {
        try {
          const actor = await fromUuid(data.actorUuid);
          telemetry('resolve-token-actorUuid', { actorId: actor?.id, actorUuid: actor?.uuid, actorName: actor?.name });
          return actor;
        } catch (err) {
          telemetry('resolve-token-actorUuid-error', { err });
        }
      }
      const token = data.uuid ? await fromUuid(data.uuid) : null;
      telemetry('resolve-token-uuid', {
        tokenUuid: token?.uuid,
        actorId: token?.actor?.id,
        actorUuid: token?.actor?.uuid,
        actorName: token?.actor?.name,
      });
      return token?.actor ?? null;
    }

    if (data.type !== 'Actor') {
      telemetry('resolve-unsupported-type', { type: data.type });
      return null;
    }

    if (data.uuid) {
      try {
        const actor = await fromUuid(data.uuid);
        telemetry('resolve-uuid', { actorId: actor?.id, actorUuid: actor?.uuid, actorName: actor?.name });
        return actor;
      } catch (err) {
        telemetry('resolve-uuid-error', { err });
      }
    }

    if (data.id) {
      const actor = game.actors.get(data.id);
      telemetry('resolve-id', { id: data.id, actorId: actor?.id, actorUuid: actor?.uuid, actorName: actor?.name });
      if (actor) return actor;
    }

    try {
      const actor = await Actor.implementation.fromDropData(data);
      telemetry('resolve-fromDropData', { actorId: actor?.id, actorUuid: actor?.uuid, actorName: actor?.name });
      return actor;
    } catch (err) {
      telemetry('resolve-fromDropData-error', { err });
    }

    return null;
  }

  function actorToEntry(actor) {
    return {
      id: actor.id,
      uuid: actor.uuid,
      name: actor.name,
      img: actor.img || MYSTERY_MAN,
    };
  }

  function entryKey(entry) {
    return entry.uuid || entry.id;
  }

  async function handleDrop(data) {
    telemetry('drop-start', { data, localList });
    if (!isEditing) {
      ui.notifications.error(localize('EditModeRequired'));
      return;
    }

    const actor = await resolveActor(data);
    if (!actor) {
      telemetry('drop-no-actor', { data });
      ui.notifications.warn(localize('CouldNotResolveActor'));
      return;
    }

    const entry = actorToEntry(actor);
    if (localList.some((existing) => entryKey(existing) === entryKey(entry))) {
      telemetry('drop-duplicate', { entry, localList });
      return;
    }

    const nextList = [...localList, entry];
    await persist(nextList);
    localList = nextList;
    telemetry('drop-complete', {
      entry,
      flagsAfter: $doc.getFlag?.(MODULE_ID, 'configuration')?.associatedActors,
    });
    ui.notifications.info(`${localize('AssociatedActors')}: ${entry.name}`);
  }

  async function handleDropEvent(event) {
    event.preventDefault();
    event.stopPropagation();

    const textEditor = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
    const data = textEditor.getDragEventData(event);
    telemetry('native-drop-event', {
      data,
      rawText: event.dataTransfer.getData('text/plain'),
      types: Array.from(event.dataTransfer?.types ?? []),
    });
    await handleDrop(data);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  async function handleRemove(index) {
    telemetry('remove-start', { index, localList });
    const nextList = localList.filter((_, i) => i !== index);
    await persist(nextList);
    localList = nextList;
    telemetry('remove-complete', {
      flagsAfter: $doc.getFlag?.(MODULE_ID, 'configuration')?.associatedActors,
    });
  }

  async function persist(list) {
    if (onPersist) {
      telemetry('persist-external', { nextList: list });
      await onPersist(list);
      return;
    }

    const configuration = $doc.getFlag?.(MODULE_ID, 'configuration') ?? {};
    telemetry('persist-before', {
      nextList: list,
      existingConfiguration: configuration,
      flagsBefore: $doc.getFlag?.(MODULE_ID, 'configuration')?.associatedActors,
    });
    await $doc.setFlag(MODULE_ID, 'configuration', {
      ...configuration,
      associatedActors: list,
    });
    telemetry('persist-after', {
      flagsAfter: $doc.getFlag?.(MODULE_ID, 'configuration')?.associatedActors,
    });
  }

  async function openSheet(entry) {
    const actor = entry.uuid ? fromUuidSync(entry.uuid) : game.actors.get(entry.id);
    actor?.sheet?.render(true);
  }
</script>

<template lang="pug">
  .actor-bucket(on:dragover|preventDefault="{handleDragOver}" on:drop|capture|preventDefault|stopPropagation="{handleDropEvent}")
    h2 {localize('AssociatedActors')} ({localList.length})
    DropZone(placeholder="{placeholder}" acceptType="" onDrop="{handleDrop}")
      +if("localList.length > 0")
        ul.actor-bucket__list
          +each("localList as entry, index")
            li.actor-bucket__entry
              button.actor-bucket__open(type="button" on:click!="{() => openSheet(entry)}")
                img.actor-bucket__img(src="{entry.img || MYSTERY_MAN}" alt="{entry.name}")
                span.actor-bucket__name {entry.name || localize('UnknownActor')}
              button.actor-bucket__remove(type="button" data-tooltip="{localize('Types.Actor.ActionButtons.Delete')}" on:click!="{() => handleRemove(index)}")
                i.fa.fa-trash
      +if("localList.length === 0")
        p.actor-bucket__empty {emptyText}
</template>

<style lang="sass">
  .actor-bucket
    display: flex
    flex-direction: column
    gap: 0.5rem

    h2
      margin: 0

    :global(.drag-drop-area)
      display: flex
      flex-direction: column
      gap: 0.5rem

  .actor-bucket__list
    list-style: none
    margin: 0
    padding: 0
    display: flex
    flex-direction: column
    gap: 0.25rem

  .actor-bucket__entry
    display: flex
    align-items: center
    gap: 0.4rem
    min-height: 32px

  .actor-bucket__open
    flex: 1
    min-width: 0
    display: grid
    grid-template-columns: 28px minmax(0, 1fr)
    align-items: center
    gap: 0.5rem
    padding: 0.2rem 0.35rem
    border: 0
    background: transparent
    color: var(--gas-color-text)
    text-align: left
    cursor: pointer

    &:hover
      color: var(--gas-tab-active-color)
      background: color-mix(in srgb, var(--gas-tab-active-indicator) 10%, transparent)
      border-radius: 3px

  .actor-bucket__img
    width: 24px
    height: 24px
    object-fit: cover
    border: 0
    border-radius: 3px
    max-width: 24px
    max-height: 24px
    margin-right: 0.5rem

  .actor-bucket__name
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

  .actor-bucket__remove
    width: 24px
    height: 24px
    flex: 0 0 24px
    margin-left: 0.5rem
    display: inline-flex
    align-items: center
    justify-content: center
    padding: 0
    border: 0
    background: transparent
    color: var(--gas-color-text)
    cursor: pointer
    opacity: 0.65

    &:hover
      opacity: 1
      color: var(--gas-color-negative)

  .actor-bucket__empty
    margin: 0
    color: color-mix(in srgb, var(--gas-color-text) 50%, transparent)
    font-style: italic
    font-size: 0.9em
</style>
