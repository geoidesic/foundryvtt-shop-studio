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

## Status Tracker

> **Last updated: 2026-06-13**
> Legend: ✅ Done | 🔧 In progress | ❌ Not started | ⏭️ Deferred/blocked | 🔄 Changed approach

### Core Architecture

| Item | Status | Notes |
|---|---|---|
| Actor type strategy | 🔄 | **Diverged from plan.** Using NPC type + identity flags instead of custom `shop` type. See `Agents.md`. |
| `ShopActor` class | ✅ | Defined in `src/actors/ShopActor.js`, registered in `src/index.js` via `registerShopActor()`. |
| `ShopActorModel` data model | ✅ | `src/models/actors/ShopActorModel.js` — defines full schema (configuration, stock, transactions, currency, identity). |
| `ShopActorSheet` (SvelteDocumentSheet) | ✅ | `src/sheets/ShopActorSheet.js` — GM + Player sheets rendered via TyphonJS. |
| Sheet registration | ✅ | Registered for both `SHOP_ACTOR_TYPE` (`'npc'`) and `LEGACY_SHOP_ACTOR_TYPE` (`'shop'`) in `src/index.js`. |
| Legacy compatibility (`isShop` getter) | ✅ | `ShopActor.isShop` checks both legacy `type === 'shop'` and flag-based identity. |

### Settings & Configuration

| Item | Status | Notes |
|---|---|---|
| Debug settings | ✅ | Debug + debugHooks toggles registered. |
| Sidebar button toggle | ✅ | `showButtonInSideBar` world setting. |
| Don't show welcome | ✅ | User-level setting. |
| Item sources settings | ✅ | Registered but UI (`ItemSourcesApp`) is placeholder. |
| Item field mapping | ❌ | Not implemented. Plan calls for structured settings UI to map logical fields to document paths. |
| Price modulation UI | 🔧 | `salePriceFactor`/`buyPriceFactor`/`priceVariance` controls exist in `ShopSheetGM.svelte` but not fully wired to settings persistence. |
| Proximity enforcement | ❌ | Not implemented. |
| Shop classes registry | ❌ | Not implemented. |

### UI & UX

| Item | Status | Notes |
|---|---|---|
| Shop sidebar button | ✅ | Injected into Actor Directory via `renderShopStudioSidebarButton()`. |
| Create Actor dialog injection | ✅ | "Shop" option added via `renderShopTypeInCreateActorApplication()`. |
| GM shop sheet (ShopSheetGM) | ✅ | Tabs: Shopfront, Inventory, Settings. |
| Player shop sheet (ShopSheetPlayer) | ✅ | Tabs: Shopfront, Inventory. |
| Shopfront tab (GM) | ✅ | Profile image, name, description (ProseMirror), associated actors, roll tables. |
| Shopfront tab (Player) | ✅ | Profile image, name, enriched description. |
| Inventory tab | ✅ | Filterable item list with embedded document management. |
| Settings tab | 🔧 | Configuration UI exists in GM sheet but needs full field mapping support. |
| Welcome application | ✅ | Shown on first load. |
| Token HUD integration | ❌ | Not implemented. |

### Stores & State

| Item | Status | Notes |
|---|---|---|
| `shopCatalog` store | ✅ | `src/stores/shopCatalog.js` — catalogItems, catalogLoading, catalogError, loadCatalogItems(). |
| `shopInventory` store | ✅ | `src/stores/shopInventory.js` — catalogItems, shopCart, priceMultiplier, cartTotal derived store. |
| `initialiseShopState()` | ✅ | Resets stores when actor changes. |

### Services (Planned but Not Built)

| Item | Status | Notes |
|---|---|---|
| `StockService` / `randomiseStock()` | ❌ | No `src/services/` directory exists. |
| `PurchaseService` / purchase pipeline | ❌ | No purchase flow beyond Actor Studio's existing equipment purchase. |
| Transaction logging | ❌ | Schema defined in `ShopActorModel` (transactions ArrayField) but no code writes to it. |
| Actor selection dialog for players | ❌ | Not implemented. |

### Integration & Hooks

| Item | Status | Notes |
|---|---|---|
| `gss.openShopStudio` hook | ✅ | Fired on sidebar button click. |
| Actor Directory injection | ✅ | Both V12 (`renderActorDirectory`) and V13+ (`activateActorDirectory`). |
| Render Application hooks | ✅ | V12 (`renderApplication`) and V13+ (`renderApplicationV2`) for creation dialog. |
| Token HUD controls | ❌ | Not implemented. |
| Socket coordination | ❌ | Not implemented. |

### Testing

| Item | Status | Notes |
|---|---|---|
| Vitest harness setup | ❌ | `src/tests/` exists but only contains `Agents.md`. |
| Unit tests for services | ❌ | No services to test yet. |
| Component tests | ❌ | Not started. |

### Data Storage Schema

| Item | Status | Notes |
|---|---|---|
| `system.configuration` | ✅ | Pricing factors, variance, associated actors, roll tables. |
| `system.stock` | ✅ | Stock snapshot array. |
| `system.transactions` | ✅ | Transaction log array. |
| `system.identity` | ✅ | isShop flag + kind. |
| `system.description` | ✅ | Rich text description. |
| `system.currency` | ✅ | Schema defined but minimal. |

## Immediate Next Steps
- [ ] Implement `src/services/StockService.js` — stock randomisation from compendiums.
- [ ] Implement item field mapping settings UI (document path mappings for price, currency, quantity).
- [ ] Implement purchase pipeline: actor selection -> proximity check -> currency validation -> purchase -> transaction logging.
- [ ] Add Token HUD integration (`renderTokenHUD` hook) for quick shop controls.
- [ ] Add Vitest harnesses copying Actor Studio's mock strategy for consistent testing.
