# Actor Data Models - Best Practices

## Key Learnings

### 1. Data Model Registration

**Problem**: Shop actors were being created with the wrong system type (`NPCData` instead of the custom model).

**Solution**: Register the data model via `CONFIG.Actor.dataModels[actorType]` in the `registerShopActor()` function:

```javascript
// In ShopActor.js
CONFIG.Actor.dataModels[SHOP_ACTOR_TYPE] = ShopActorModel;
```

This ensures FoundryVTT uses the custom model for actors of the specified type.

### 2. Avoiding Circular Dependencies

**Problem**: `ShopActor.js` and `ShopActorModel.js` were importing from each other, causing circular dependency issues.

**Solution**: Extract shared constants to a separate file:

```javascript
// src/constants/shopConstants.js
export const SHOP_ACTOR_TYPE = 'npc';
export const SHOP_FLAG_KEYS = Object.freeze({ ... });
// etc.
```

Both files now import from `shopConstants.js` instead of each other.

### 3. Model Inheritance Pattern

**Problem**: The `ShopActorModel` needed to include the `description` field but wasn't inheriting from a base model.

**Solution**: Create a `BaseActorModel` that extends `foundry.abstract.TypeDataModel` and includes common fields:

```javascript
class BaseActorModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ required: false, blank: true, initial: '' }),
    };
  }
}

export class ShopActorModel extends BaseActorModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),  // Include base fields
      // ... shop-specific fields
    };
  }
}
```

### 4. ProseMirror Component Integration

**Problem**: The ProseMirror editor wasn't persisting content to the actor's `system.description` field.

**Solution**: 
- Use reactive `$: options` declaration so options update when the document changes
- Pass the unwrapped document (`$doc`) to TJSProseMirror
- Add `bind:content` and `bind:enrichedContent` for two-way sync
- Fix prop defaults (`classes` to array, `editable` to undefined)

```svelte
$: options = {
  document: $doc,
  fieldName: attr,
  classes,
  editable,
};
```

## Future Work Guidelines

### When Creating New Actor Models

1. **Define the schema** with all required fields using Foundry's field types
2. **Extend the base model** to inherit common fields like `description`
3. **Register the model** in `CONFIG.Actor.dataModels` for the appropriate actor type
4. **Avoid circular imports** by extracting shared constants to a separate file
5. **Test persistence** by creating an actor and verifying data saves correctly

### When Using ProseMirror

1. **Always use reactive options** (`$:` prefix) for the options object
2. **Pass the unwrapped document** (`$doc`) not the store (`doc`)
3. **Include content bindings** for two-way sync
4. **Verify the field path** matches the model's schema (e.g., `system.description`)