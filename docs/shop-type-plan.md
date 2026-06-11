# Shop Actor Type Plan

## Goal
Implement a custom shop actor type that passes Foundry and system validation without modifying core/system source.

## Decisions
- Use a namespaced actor type: `foundryvtt-shop-studio.shop`
- DO NOT keep compatibility checks for legacy actors with type `shop`
- Register actor type metadata in both `CONFIG` and system document type registries

## Implementation Steps
1. Define actor type constants
- `SHOP_ACTOR_TYPE = ${MODULE_ID}.shop`

2. Register actor types during init and ready
- Add type label for namespaced type
- Ensure actor type exists in `game.system.documentTypes.Actor`
- Ensure actor type key exists in `game.model.Actor`

3. Update all creation and lookup paths
- Create new actors with namespaced type
- Resolve existing shops by namespaced type (plus legacy fallback)

4. Backward compatibility
- Treat both namespaced and legacy types as shop actors for runtime checks
- Optional future migration: convert legacy actors to namespaced type

## Verification
- Create a new shop actor and confirm no validation error is thrown
- Open the shop sheet and confirm Svelte sheet renders correctly
- Verify sidebar create/open flow works for both new and legacy actors
- Confirm actor type appears with Shop label in actor UI where applicable
