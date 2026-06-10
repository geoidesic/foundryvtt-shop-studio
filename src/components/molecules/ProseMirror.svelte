<svelte:options accessors={true} />

<script>
  import { getContext } from 'svelte';
  import { TJSProseMirror } from '#standard/component/fvtt/editor';

  export let attr = '';
  export let classes = '';
  export let editable = '';

  const doc = getContext('#doc');

  $: options = {
    document: $doc,
    fieldName: attr,
    classes: classes ? [classes] : void 0
  };

  let content = '';
  let enrichedContent = '';
</script>

<TJSProseMirror
  {options}
  {...$$restProps}
  bind:content
  bind:enrichedContent
/>
