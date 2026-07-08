# Shop Actor Type Plan (Status: SUPERSEDED)

> **2025-10-16**: The original plan to use a namespaced actor type (`foundryvtt-shop-studio.shop`)
> was abandoned because D&D 5e's actor creation dialog rejects unknown types. The actual
> implementation uses **NPC type + identity flags** instead. See `Agents.md` for full details.
> This document is kept for historical reference only.

## Original Goal
Implement a custom shop actor type that passes Foundry and system validation without modifying core/system source.

## Original Decisions
- Use a namespaced actor type: `foundryvtt-shop-studio.shop`
- Keep compatibility checks for legacy actors with type `shop`
- Register actor type metadata in both `CONFIG` and system document type registries

## Original Implementation Steps (All OUTDATED — See Agents.md)
1. Define actor type constants
   - `SHOP_ACTOR_TYPE = ${MODULE_ID}.shop` → **Actual: `'npc'`**
   - `LEGACY_SHOP_ACTOR_TYPE = shop` → **Still defined but unused in creation paths**

2. Register actor types during init and ready
   - ~~Add type label for namespaced type~~ → **Only legacy label registered**
   - ~~Ensure actor type exists in `game.system.documentTypes.Actor`~~ → **Not done**
   - ~~Ensure actor type key exists in `game.model.Actor`~~ → **Not done**

3. Update all creation and lookup paths
   - ~~Create new actors with namespaced type~~ → **Created as `npc` + shop identity flags**
   - Resolve existing shops by namespaced type (plus legacy fallback) → **Using `isShop` getter only**

4. Backward compatibility
   - Treat both namespaced and legacy types as shop actors for runtime checks → **Using `isShop` getter on ShopActor**
   - Optional future migration: convert legacy actors to namespaced type → **Not implemented**

## What Actually Happened (Workaround)

*This section documents the implemented strategy — see `Agents.md` for the authoritative reference.*

### Problem
D&D 5e does not respect arbitrary custom actor `type` values. When attempting to create an
actor with a fully custom type, dnd5e validation either rejects it or falls back to a
default type.

### Solution
We use an **NPC + flags workaround**:
1. `SHOP_ACTOR_TYPE = 'npc'` — actors are created as NPCs to satisfy dnd5e validation.
2. The Create Actor dialog is hijacked: a "Shop" radio option is injected, and on submit, the type is
   silently changed to `npc` while hidden fields inject `flags.core.sheetClass`,
   `flags.shop-studio.identity.isShop`, and `flags.shop-studio.identity.kind`.
3. `ShopActorModel` is registered as the data model for `SHOP_ACTOR_TYPE` (`'npc'`), so **every NPC**
   gets the shop data model. The `isShop` getter on `ShopActor` must be checked to determine if an NPC
   was actually created as a shop.
4. `ShopActorSheet` is registered for both `SHOP_ACTOR_TYPE` (`'npc'`) and `LEGACY_SHOP_ACTOR_TYPE`
   (`'shop'`).

### Current Constants (shopConstants.js)
| Symbol | Value |
|---|---|
| `LEGACY_SHOP_ACTOR_TYPE` | `'shop'` |
| `SHOP_ACTOR_TYPE` | `'npc'` |
| `SHOP_IDENTITY_KIND` | `'shop-studio.shop'` |
| `SHOP_FLAG_SCOPE` | `'shop-studio'` |

### Limitations of This Approach
- **Every NPC gets the ShopActorModel data model**, which could cause issues with non-shop NPCs.
  The `isShop` getter must always be checked before treating an actor as a shop.
- Sheet registration for `SHOP_ACTOR_TYPE` (`'npc'`) means ShopActorSheet may appear as an option
  for all NPCs — sheet registration uses `makeDefault: false` to mitigate this.

## Current Status
- **Achieved**: Shop creation, sheet rendering, sidebar flow, legacy support via `isShop` getter.
- **Not done**: `game.system.documentTypes.Actor` injection, `game.model.Actor` key registration,
  migration scripts for legacy actors.
- **Deliberately diverged**: Namespaced type → NPC + flags workaround. All creation goes through
  dialog hijacking in `shopStudioButtons.js`.
