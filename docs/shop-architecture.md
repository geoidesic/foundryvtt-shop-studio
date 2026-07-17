# Shop Studio Architecture

> Last updated: 2026-07-08

This document describes the implemented architecture, not a roadmap.

## Core Shape

- Shop Studio is a FoundryVTT actor-based shop module.
- Shop state lives on the actor through flags and system data.
- GM and player sheets are separate Svelte/TJSDocument views.
- `shopConfig` is the local Svelte store used to keep GM settings UI reactive.

## Data Flow

- Actor flags remain the source of truth for persisted configuration.
- `getShopConfiguration()` reads the actor flags and normalises defaults.
- `setShopConfiguration()` writes the merged configuration back to the actor.
- `ShopSheetGM.svelte` hydrates the store from actor flags when the actor changes.
- `SettingsTab.svelte` edits the shared store, then `saveSettings()` persists it.
- Roll table counts are stored alongside `rollTables` as `rollTableRolls` and are normalised whenever the table list changes.
- The settings tab treats the shared store as the reactive source of truth and syncs pruned counts back into the store before save.

## UI Surfaces

- `ShopSheetGM.svelte` handles GM editing, provisioning, and store configuration.
- `ShopSheetPlayer.svelte` handles player-facing browsing and basket interaction.
- `SettingsTab.svelte` contains the persisted pricing sliders and roll table controls.
- Tabs receive shared props, but persistence is driven through the store and actor flags.

## Provisioning

- Roll table provisioning is owned by `ShopSheetGM.svelte`.
- Configured table refs and roll counts come from `shopConfig`.
- Each configured table is rolled according to its matching count from `rollTableRolls`.
- Provisioning resolves roll results to Item documents, then upserts shop inventory.
- Duplicate provisioned items are keyed by `type::name` and increment quantity, not rows.

## Persistence Boundaries

- Do not treat local component state as durable.
- Do not write settings directly from the tab view to the actor without syncing the shared store.
- The save path must keep the store and actor flags aligned so the UI reopens with the same values.
