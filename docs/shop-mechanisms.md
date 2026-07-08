# Shop Studio Mechanisms

> Last updated: 2026-07-08

This document records the implementation mechanisms that are easy to forget.

## Actor Creation Workaround

- `SHOP_ACTOR_TYPE` is `npc`, not a custom actor type.
- The Create Actor dialog injects a visible Shop option for users.
- On submit, the selected shop type is rewritten to `npc`.
- Hidden fields inject shop identity and sheet class flags.
- `ShopActorModel` is registered against `npc`, so shop actors hydrate correctly.

## Shop Identity

- Shop identity is flag-based.
- `isShop` and `kind` identify a shop actor.
- `LEGACY_SHOP_ACTOR_TYPE` is still kept for backward compatibility.
- `CONFIG.Actor.documentClass` is not overridden by the module.

## GM Settings Persistence

- `SettingsTab.svelte` binds the range inputs to the shared `shopConfig` store.
- Slider movement updates the store immediately.
- `saveSettings()` snapshots the store, writes it to actor flags, then refreshes the store.
- The store update must use `set()` or the function form of `update()`.
- Roll table counts are reactive store state, not local tab-only state.
- The roll-table count array must stay index-aligned with `rollTables` and be pruned when tables are removed.

## Reopen Behavior

- The GM sheet rehydrates `shopConfig` from actor flags when the actor changes.
- This keeps slider thumbs, labels, and saved values aligned after closing and reopening the sheet.
- If the store and actor flags diverge, the actor flags win on next hydrate.

## Provisioning

- `ShopSheetGM.svelte` rolls each configured table by its stored count during provisioning.
- Draw results may need normalising before iterating.
- Resolve table result docs through UUIDs, `documentCollection`/`documentId`, world collections, or packs.
- Before writing inventory, group rolled items by `type::name`.
- Existing matches get `system.quantity` increments; new matches create one row with accrued quantity.
