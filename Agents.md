# Project rules
Never edit dist. 
Never run build. 
Never manually copy dist/ output to the Foundry Data modules folder — HMR + symlinks handle propagation automatically.
Always lint errors.
When editing Pug templates: make ONE edit at a time, then check the `bun dev` terminal logs for compile errors before the next edit.

# Javascript rules
Always use ESM import
Never use require

# Development
## package.json rules
Never use `npm`. Always use `bun` instead.
```bash
bun dev           # Never use build commands - HMR handles compilation
nvm use 24        # If node issues occur
```
This is a foundryvtt module and as such conforms to the FoundryVTT API spec, so reference it when writing game logichttps://foundryvtt.wiki/en/development/api

## Pug Template Rules

### Syntax Requirements
- ALL Svelte components MUST use Pug templates with `<template lang="pug">` - NEVER use standard HTML markup
- Pug templates with Svelte preprocessing (NOT standard Pug)

### Pug Syntax Rules
- Conditionals: `+if("condition")` with condition in double quotes
- Else blocks: `+else()` or `+else` - **MUST be indented one level deeper than `+if`** (as a child block, not sibling)
- **CRITICAL**: `+else` indentation:
  ```pug
  +if("condition")
    p Content if true
    +else()
      p Content if false
  ```
  NOT:
  ```pug
  +if("condition")
    p Content if true
  +else()
    p Content if false
  ```
- Else-if logic: Use nested `+if`/`+else` blocks (no `+elseif`)
- Loops: `+each("array as item")` with expression in double quotes
- Attributes: Use `!=` for complex expressions, e.g., `class:selected!="{isSelected(item)}"`
- Svelte raw HTML in Pug: when rendering `{@html ...}` as a standalone line, **MUST** use a pipe prefix: `| {@html richHTML}` (do not place bare `{@html ...}` on its own line in Pug blocks)
- Text content: Inline with elements, e.g., `button(type="button") Text`

### Expression and Event Handling
- Avoid long expressions in attributes - extract to script functions
- Do not use compound expressions, instead wrap them as functions
- Event handlers must use the `!=` operator to prevent HTML encoding
- Avoid arrow functions and the `=` operator in event handlers

## i18n Localization Rules

### localize() Helper Usage
- Always use `localize()` from `~/src/helpers/Utility` for GAS-namespaced strings — pass the key **without** the `GAS.` prefix (e.g. `localize("Footer.Cancel")`).
- Only fall back to `game.i18n.localize` / `game.i18n.format` for core Foundry keys that are not in the GAS namespace (e.g. `"DOCUMENT.ImportData"`).
- Ensures consistent localization and avoids namespace issues.

## Foundry API notes
Is current user GM? - `game.user.isGM`

## Git access
Use `gh`

# Actor Type Workaround (Custom Shop Type via NPC + Flags)

## Problem
D&D 5e (and the core Foundry actor creation dialog) does not respect arbitrary custom actor `type` values such as `shop-studio.shop`. When attempting to create an actor with a fully custom type, dnd5e validation either rejects it or falls back to a default type, causing our custom `ShopActorModel` and `ShopActorSheet` to never be applied.

## Solution / Workaround
We use the following mechanism to ensure our custom sheet and data model are used while still passing dnd5e validation:

1. **Registered Actor Type**: `SHOP_ACTOR_TYPE` is defined as the string `"npc"` (see `src/constants/shopConstants.js`).
   - This allows the actor to be created through the standard dnd5e "NPC" type path, satisfying all dnd5e validation rules.

2. **User-Facing Dialog Type**: `SHOP_DIALOG_TYPE` (`shop-studio.shop`) is defined locally in `src/hooks/shopStudioButtons.js` and injected into the Create Actor dialog UI (both radio-button list and `<select>` versions) so the user sees a friendly "Shop" option.

3. **Type Substitution on Submit**: When the form is submitted and the user selected the shop option:
   - `setSelectedType(form, SHOP_ACTOR_TYPE)` changes the submitted `type` value from `shop-studio.shop` to `npc`.
   - `applyShopCreationFields(form)` injects hidden inputs that set:
     - `flags.core.sheetClass` → `shop-studio.ShopActorSheet`
     - `flags.shop-studio.identity.isShop` → `true` (Boolean)
     - `flags.shop-studio.identity.kind` → `shop-studio.shop`
     - `img` → `icons/environment/settlement/warehouse-crates.webp`

4. **Data Model Registration** (in `registerShopActor()`, `src/actors/ShopActor.js`):
   ```js
   CONFIG.Actor.dataModels[SHOP_ACTOR_TYPE] = ShopActorModel; // "npc" → ShopActorModel
   ```
   This ensures that any actor whose `type` is `"npc"` but carries the shop identity flags will be hydrated with `ShopActorModel`.

5. **Document Class (NOT SET)** — See note below.

   `CONFIG.Actor.documentClass` is **not** overridden by Shop Studio. The `ShopActor` class defined in `src/actors/ShopActor.js` is created via `registerShopActor()` and returned (available for subclassing), but `CONFIG.Actor.documentClass` is never reassigned. Sheet `options.document` uses whatever the game system provides (e.g., `Actor5e`).

   > **Note:** A stale `src/extensions/Actor.js` exists as a separate `ShopActor extends Actor` file, but it is **never imported** anywhere in the module. It should be considered dead code.

## Constants Summary (current values)
- `LEGACY_SHOP_ACTOR_TYPE` = `'shop'`
- `SHOP_ACTOR_TYPE` = `'npc'`
- `SHOP_DIALOG_TYPE` = `'foundryvtt-shop-studio.shop'` (local to `shopStudioButtons.js`)
- `SHOP_IDENTITY_KIND` = `'foundryvtt-shop-studio.shop'`
- `SHOP_FLAG_SCOPE` = `'foundryvtt-shop-studio'`
- `SHOP_FLAG_KEYS.identity` = `'identity'`

## Rationale for Rollback
Commit `3f66a6235756126b9a3c073dd3c43704db61ff01` on `main` represents the last known-good state that correctly implements the above workaround. The branch `sort-out-actor-type` explored an alternative approach that ultimately did not resolve the dnd5e type-validation issue. A hard reset back to the `npc` + flags mechanism was required to restore working shop creation.

## Maintenance Notes
- Never change `SHOP_ACTOR_TYPE` away from `"npc"` without also updating the entire flag-injection and dialog-hijacking logic in `shopStudioButtons.js`.
- The hidden-field injection (`ensureShopHiddenField`, `applyShopCreationFields`) and the submit handler in `renderShopTypeInCreateActorApplication` are the single source of truth for ensuring the correct sheet and identity flags are set at creation time.
- If dnd5e ever relaxes its type validation, the workaround can be revisited, but the flag-based identity mechanism should remain for backward compatibility with existing shop actors.
