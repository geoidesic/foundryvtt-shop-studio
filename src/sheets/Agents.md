
## Sheet/store contract

- Document sheets wrap a Foundry document in a `TJSDocument` store.
- The sheet exposes that store to Svelte through `defaultOptions.svelte.props.documentStore`.
- The shell receives `documentStore`, then sets Svelte context:
  - `setContext("#doc", documentStore)`
- Components below the shell read it with:
  - `const doc = getContext("#doc");`
- Use `$doc` in the template/reactive statements because `TJSDocument` is a Svelte store.

Base pattern:

```js
#documentStore = new TJSDocument(void 0, { delete: this.close.bind(this) });

Object.defineProperty(this.reactive, "document", {
  get: () => this.#documentStore.get(),
  set: (document) => this.#documentStore.set(document),
});

this.reactive.document = object;
```

```svelte
<script>
  import { setContext } from "svelte";

  export let documentStore;

  setContext("#doc", documentStore);
</script>
```

## Self-persisting atoms

A self-persisting atom owns enough context to read and write its target document field directly.

Typical props:

```svelte
export let valuePath = "";
export let document = false;
export let handleOwnUpdates = true;
```

Then resolve the document:

```js
const doc = document || getContext("#doc");
```

Persist directly:

```js
await $doc.update({ [valuePath]: value });
```

or, for nested/dot paths:

```js
const updateObj = {};
foundry.utils.setProperty(updateObj, valuePath, value);
await $doc.update(updateObj);
```

Examples:
- `DocInput.svelte` reads `valuePath`, updates `$doc` on Enter/blur/input depending on mode.
- `DocSelect.svelte` builds a dot-path update object with `foundry.utils.setProperty`.
- `DocCheckbox.svelte` binds a checkbox and writes `Boolean(inputValue)` back to `$doc`.
- `Attribute.svelte` reads `$actor.system.attributes[key][code].val` and calls `$actor.update(...)`.

## General reactive persistence

Use one document store per sheet, then let descendants derive from it.

Common patterns:

```js
const actor = getContext("#doc");
$: value = $actor.system.some.path;
```

For embedded collections:

```js
import { TJSDocument } from "#runtime/svelte/store/fvtt/document";

const Actor = getContext("#doc");
const doc = new TJSDocument($Actor);
const wildcard = doc.embedded.create(Item, {
  name: "wildcard",
  filters: [typeSearch],
  sort: (a, b) => a.name.localeCompare(b.name),
});

$: items = [...$wildcard];
```

Use `item.update(...)`, `item.delete()`, or actor-level `$doc.update(...)` when mutating embedded documents.

For flags:

```js
await $doc.setFlag(moduleId, flagPath, value);
```

For arrays/tags:

```js
const tags = [...$doc.system.tags];
tags.push(newTag);
await $doc.update({ system: { tags } });
```

## Practical rules

- Prefer reusable atoms for simple field persistence: `valuePath + $doc.update(...)`.
- Prefer molecules/organisms for multi-step persistence where validation, filtering, or embedded-document mutation is involved.
- Use `handleOwnUpdates={false}` when the parent needs to decide how to persist a change.
- Keep UI state separate from document state; only write back on explicit actions unless the UX intentionally supports live persistence.
- Do not pass raw `document` props unless you need to override the inherited `#doc` context.
- For sheet-wide state, update the root document, e.g. `system.isEditing`, from the sheet/application layer.