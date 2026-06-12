# Project rules
Never edit dist. 
Never run build. 
Never manually copy dist/ output to the Foundry Data modules folder — HMR + symlinks handle propagation automatically.
Always lint errors.

# Javascript rules
Always use ESM import
Never use require

# Development
Never use `npm`. Always use `bun` instead.
```bash
bun dev           # Never use build commands - HMR handles compilation
nvm use 24        # If node issues occur
```
This is a foundryvtt module and as such conforms to the FoundryVTT API spec, so reference it when writing game logichttps://foundryvtt.wiki/en/development/api

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

5. **Document Class Override** (also in `registerShopActor()`):
   ```js
   CONFIG.Actor.documentClass = ShopActor;
   ```
   This ensures that `options.document` on sheets is always an instance of our custom `ShopActor` (from `src/extensions/actor.js`) rather than the system base `Actor5e`.

## Constants Summary (current values)
- `LEGACY_SHOP_ACTOR_TYPE` = `'shop'`
- `SHOP_ACTOR_TYPE` = `'npc'`
- `SHOP_DIALOG_TYPE` = `'shop-studio.shop'` (local to `shopStudioButtons.js`)
- `SHOP_IDENTITY_KIND` = `'shop-studio.shop'`
- `SHOP_FLAG_SCOPE` = `'shop-studio'`
- `SHOP_FLAG_KEYS.identity` = `'identity'`

## Rationale for Rollback
Commit `3f66a6235756126b9a3c073dd3c43704db61ff01` on `main` represents the last known-good state that correctly implements the above workaround. The branch `sort-out-actor-type` explored an alternative approach that ultimately did not resolve the dnd5e type-validation issue. A hard reset back to the `npc` + flags mechanism was required to restore working shop creation.

## Maintenance Notes
- Never change `SHOP_ACTOR_TYPE` away from `"npc"` without also updating the entire flag-injection and dialog-hijacking logic in `shopStudioButtons.js`.
- The hidden-field injection (`ensureShopHiddenField`, `applyShopCreationFields`) and the submit handler in `renderShopTypeInCreateActorApplication` are the single source of truth for ensuring the correct sheet and identity flags are set at creation time.
- If dnd5e ever relaxes its type validation, the workaround can be revisited, but the flag-based identity mechanism should remain for backward compatibility with existing shop actors.
