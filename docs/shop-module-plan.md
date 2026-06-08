# Shop Studio Module Design Plan

## Overview
- Deliver an actor-based shop builder that mirrors Actor Studio's usability while remaining system agnostic for broad module adoption.
- Reuse proven patterns from FoundryVTT Actor Studio (TyphonJS + Svelte + Finity-free workflow) where practical, but isolate shop logic so it can evolve independently.
- Prioritise a viable v1 that supports manual stocking, price modulation, and controlled player purchasing; log future enhancements for negotiation states and automatic restocking.

## Core Principles
- **Actor-first architecture:** Represent each shop as a dedicated actor type (`shop`) so it inherits token profiles, directory presence, and drag-to-scene support. Persist shop state (inventory snapshots, availability, pricing rules) in actor flags.
- **System agnostic data access:** Let GMs map item data paths (price, currency, quantity, description, rarity, etc.) through module settings. Ship presets for major systems (D&D 5e, PF2e, etc.) and allow custom JSON path configuration.
- **Composable services:** Encapsulate inventory loading, stock randomisation, and purchase handling in standalone services to simplify testing and future reuse (e.g., extending to loot or quest rewards).

## Document & Data Model
- Define a new actor type `shop` via `CONFIG.Actor.documentClass` override or subclass that exposes helper getters for mapped item fields and effective price multipliers.
- Store configurable attributes under `flags.foundryvtt-shop-studio` (e.g., `priceMultiplier`, `categoryFilters`, `itemFieldMap`, `availabilityState`, `proximitySettings`, `stockSnapshot`).
- Provide migrations to add default flags to existing shop actors when settings evolve.

## Settings & Configuration
- **Compendium Sources:** Follow Actor Studio's pattern (`getPacksFromSettings`) with multi-select per shop class (weaponsmith, apothecary, etc.). Allow both global defaults and per-actor overrides.
- **Item Field Mapping:** Expose a structured settings UI to map logical fields (`price.value`, `price.denomination`, `quantity`, `description`, optional `rarity`) to document paths. Include quick-load presets for supported systems.
- **Price Modulation:** Offer slider-based global multiplier + per-shop adjustments stored on actor flags; support negative values for discounts.
- **Proximity Enforcement:** Add toggle and distance value (scene units) in settings; per-shop overrides stored in flags. Purchasing UI checks distance between buyer token and shop token when enabled.
- **Shop Classes:** Maintain a registry describing default compendiums, category tags, and imagery. Allow GMs to clone/customise class templates.

## UI & UX
- Implement a TyphonJS `ShopSheet.svelte` composed of:
  - GM management view: stock editor, randomise button, price modifier controls, field mapping preview, manual drag-drop instructions.
  - Player view: browse categories, keyword filter, cart summary, currency breakdown using mapped fields.
- Reuse Actor Studio molecules (`GoldDisplay`, cart list patterns) but adapt language to system-agnostic currency labels using mapped data.
- Token HUD integration: add `Open/Close Shop`, `Randomise Stock`, and `Settings` controls respecting GM permissions and actor flags. Opening broadcasts changes via custom hooks.

## State Management
- Create `src/stores/shopInventory.js` to manage:
  - `catalogItems` derived from compendium pulls or current stock snapshot.
  - `shopCart` per-user map (local store) with derived totals using mapped price fields.
  - `availabilityState`, `proximitySettings`, and price multipliers from actor flags.
- Provide async loaders similar to `equipmentShop.loadShopItems`, enhanced with folder-based categorisation and flag-driven filters.

## Stock Management
- Support manual drag/drop from compendiums or inventory.
- Implement a `StockService` with:
  - `buildCategories()` reading compendium folders / tags.
  - `randomiseStock({ classId, count, filters })` to populate actor flags with a curated list.
  - Deduplication and quantity normalisation via the item field map.
- Persist generated stock snapshot (item UUID, base data, adjusted price) on the actor for consistent player view until refreshed.

## Purchase Flow
- Mirror Actor Studio's purchase pipeline: load full item data via `fromUuid`, compute cost in base currency, update player actor inventory, and adjust currency using mapped field paths.
- Actor selection dialog: on player entry, present controlled actor list; remember last selection per user session.
- Enforce proximity check when enabled, then validate currency and quantity before completing purchase.
- Log transactions to actor flags (e.g., `flags...transactions[]`) for GM auditing and potential export.

## Integration & Hooks
- Register module hooks:
  - `Hooks.on('renderTokenHUD', addShopControls)` for HUD availability toggles.
  - `Hooks.on('gas.shop-state-change')` (namespace TBD) to notify clients when shops open/close or stock updates.
  - Optional `Hooks.on('socketlib.ready')` if cross-client coordination is needed for purchases.
- Ensure the module initialises settings and registers custom actor sheet on `init`, then preloads required Svelte stores on `ready`.

## Testing Strategy
- Use Vitest with Actor Studio mock patterns for Foundry globals and TyphonJS stores.
- Unit-test services (`StockService`, `PurchaseService`, field mapping resolver) with mocked compendium data.
- Component tests for `ShopSheet` verifying GM/player views under different flags and proximity configurations.

## Roadmap & Future Enhancements
1. **Negotiation States / Loyalty:** Plan a flexible modifier system that supports per-player or relationship-based pricing without locking to a specific game system. Store as optional flag maps keyed by user ID or actor UUID.
2. **Automated Restocking:** Integrate with Foundry's world time or calendar modules to refresh stock on schedule; require deterministic seeds for reproducibility.
3. **Extended Currency Support:** Allow multiple currency tracks or barter-style exchanges via settings.
4. **Analytics & Reporting:** Build dashboards or journal exports for sales history and inventory turnover.

## Immediate Next Steps
- [ ] Finalise actor sheet registration and flag schema documentation.
- [ ] Implement settings UI for compendium selection, item field mapping, and proximity controls.
- [x] Scaffolding: create `ShopActor` class, empty `ShopSheet.svelte`, and baseline stores ready for service integration. (2025-10-16)
- [ ] Draft Vitest harnesses copying Actor Studio's mock strategy for consistent testing.
