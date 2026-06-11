<svelte:options accessors={true} />

<script>
  import { TJSProseMirror } from "#standard/component/fvtt/editor";
  import { getContext } from "svelte";

  export let attr = "";
  export let classes = [];
  export let editable = void 0;

  const doc = getContext("#doc");

  /**
   * Reactive options object for TJSProseMirror.
   * TJSProseMirror expects the raw Foundry document (unwrapped from the store).
   */
  $: options = {
    document: $doc,
    fieldName: attr,
    classes,
    editable,
    button: false, // Keep editor open after save
  };

  /**
   * Bound content and enrichedContent for two-way sync with TJSProseMirror.
   */
  let content = "";
  let enrichedContent;

  // Debug probes
  $: console.log("ProseMirror: options", options);
</script>

<template lang="pug">
  +if("$doc")
    TJSProseMirror(
      {options}
      {...$$restProps}
      bind:content
      bind:enrichedContent
      on:editor:cancel!="{() => console.log('! event - editor:cancel')}"
      on:editor:enrichedContent!="{() => console.log('! event - editor:enrichedContent')}"
      on:editor:save!="{() => console.log('! event - editor:save')}"
      on:editor:start!="{() => console.log('! event - editor:start')}"
    )
</template>


