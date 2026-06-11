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
  };

  /**
   * Bound content and enrichedContent for two-way sync with TJSProseMirror.
   */
  let content = "";
  let enrichedContent;
</script>
<TJSProseMirror
  {options}
  {...$$restProps}
  bind:content
  bind:enrichedContent
  on:editor:cancel={() => console.log("! event - editor:cancel")}
  on:editor:enrichedContent={(event) => console.log(`! event - editor:enrichedContent - ${event.detail.enrichedContent}`)}
  on:editor:save={(event) => console.log(`! event - editor:save - ${event.detail.content}`)}
  on:editor:start={() => console.log("! event - editor:start")}
/>


