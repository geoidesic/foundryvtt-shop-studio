# ApplicationV2 Layout Compatibility Guide

## Problem

When upgrading to Foundry 13+ (ApplicationV2) or D&D 5e v6, custom sheet UIs often break even when their JavaScript logic remains intact. The issue stems from ApplicationV2 no longer providing the implicit flex-height chain that many legacy sheet implementations relied on.

### Symptoms

- Tab content collapsing to near-zero height
- Tab bar consuming available vertical space
- Content overflowing or appearing behind window chrome
- Two-column layouts failing to render properly
- UI elements appearing compressed or unstyled

## Root Cause

ApplicationV2's `ApplicationShell` wraps Svelte/reactive content in a `<section class="window-content">` element. Unlike legacy sheet implementations, this wrapper:

1. **Does not establish a definite height** - `min-height: 100%` alone does not work when the parent flex chain is incomplete
2. **Does not default to flex column** - Child elements may not participate in vertical flex layout
3. **Allows dnd5e v6 CSS to interfere** - The system's high-specificity tab and flex selectors can override component styling

The missing contract that typically exists in legacy sheets:

```
ApplicationShell
└── .window-content (now: implicit size, not flex column)
    └── sheet-root (expected: flex column, explicit height)
        └── .tab-content (expected: flex: 1, min-height: 0)
```

## Solution

Establish an **explicit flex-height chain** scoped to your application root:

```sass
// In your root sheet component (e.g., Sheet.svelte)
:global(.your-module-id)
  > :global(.window-content)
    display: flex
    flex-direction: column
    min-height: 0
    height: 100%
    padding: 0
    overflow: hidden

  :global(.sheet-root)
    display: flex
    flex: 1 1 auto
    flex-direction: column
    min-height: 0
    height: 100%

  :global(.sheet-body)
    display: flex
    flex: 1 1 auto
    flex-direction: column
    min-height: 0
    height: 100%
```

### Tab Bar Specifics

If you use custom tabs, avoid legacy sizing patterns:

**Don't:**
```scss
.tabs-list {
  height: 100%;  // Collapses in V2
  flex: 0;       // No minimum dimension
  button {
    height: 200%;
    margin: -10px 2px;
    margin-bottom: -10px;
    padding: 11px 0;
  }
}
```

**Do:**
```scss
.tabs-list {
  height: 2.5rem;
  min-height: 2.5rem;
  flex: 0 0 2.5rem;
  align-items: stretch;
  button {
    height: auto;
    min-height: 0;
    margin: 0 2px;
    padding: 0 0.75rem;
    align-items: center;
  }
}
```

## Backwards Compatibility

This approach works across versions because:

1. **Scoped selectors** - Using `:global(.your-module-id)` prevents conflicts with core Foundry or system styles
2. **Explicit height** - `height: 100%` is safe regardless of parent flex behavior
3. **Modern flex** - Flexbox has been well-supported for years; the pattern degrades gracefully
4. **No system overrides** - Don't override `.window-content` globally; scope to your app only

## Best Practices

1. **Never rely on implicit window height** - Always establish explicit height in your sheet root
2. **Use `min-height: 0` on flex children** - This allows content to shrink properly within overflow containers
3. **Isolate tab styles** - Give your tabs fixed heights rather than percentage-based or flexible heights
4. **Test on multiple versions** - Run your module against Foundry 12+ and the target system version
5. **Avoid system selectors** - Don't use `.dnd5e-sheet`, `.actor-sheet`, or similar in your CSS

## Template

Here's a ready-to-use template for new Svelte sheets:

```svelte
<script>
  import { ApplicationShell } from '#runtime/svelte/component/application';
  // ... your imports
</script>

<template lang="pug">
  ApplicationShell(bind:elementRoot)
    +if("showGM")
      SheetGM({ documentStore })
    +else()
      SheetPlayer({ documentStore })
</template>

<style lang="sass">
  :global(.your-module-id)
    > :global(.window-content)
      display: flex
      flex-direction: column
      min-height: 0
      height: 100%
      padding: 0
      overflow: hidden

    :global(.sheet-root)
      display: flex
      flex: 1 1 auto
      flex-direction: column
      min-height: 0
      height: 100%

    :global(.sheet-body)
      display: flex
      flex: 1 1 auto
      flex-direction: column
      min-height: 0
      height: 100%
</style>
```

## Debugging

If layout issues persist, inspect this chain in browser devtools:

```
windowContent
  ├── sheetRoot
  │   └── sheetBody
  │       └── tabs
  │           ├── tabsList
  │           └── tabContent
```

Check for each element:
- `display` is `flex`
- `height` is explicitly set (not `auto`)
- `min-height` is `0` on scrollable flex children

If any element has `height: auto` or an undefined computed height, that breaks the flex chain.

## References

- ApplicationV2 Architecture (Foundry VTT)
- Flexbox Layout Module (MDN)
- Shop Studio's Implementation (src/components/sheets/ShopSheet.svelte)
