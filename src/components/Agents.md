
# Markup
ALL Svelte components MUST use Pug templates with `<template lang="pug">` - NEVER use standard HTML markup

## Indentation
- **Description**: In Pug templates, +else() statements must be nested within the related +if statement, indented one level deeper.
- **Examples**:
  - **Correct**:
    ```pug
    +if("condition")
      element
      +else()
        other-element
    ```
  - **Incorrect**:
    ```pug
    +if("condition")
      element
    +else()
      other-element
    ```

## Content
- **Description**: Content must always be contained within an element, never as a bare pipe beneath an +if statement.
- **Examples**:
  - **Correct**:
    ```pug
    +if("condition")
      span content here
    ```
  - **Incorrect**:
    ```pug
    +if("condition")
      | content here
    ```

## Conditional Logic
- **Description**: Only separate +if() and +else() statements are supported. Structure logic as separate conditional blocks.
- **Examples**:
  - **Correct**:
    ```pug
    +if("type === 'tool'")
      .tool-config
    +if("type === 'armor'")
      .armor-config
    +if("type === 'weapon'")
      .weapon-config
    ```
  - **Incorrect**:
    ```pug
    +if("type === 'tool'")
      .tool-config
    +else if("type === 'armor'")
      .armor-config
    +else if("type === 'weapon'")
      .weapon-config
    ```

## Event Handlers
- **Description**: Event handlers must use the != operator to prevent HTML encoding. Avoid arrow functions and the = operator.
- **Examples**:
  - **Correct**:
    ```pug
    button(on:click!="{handleClick(param)}")
    button(on:click!="{handleClick}")
    div(class!="{isActive ? 'active' : ''}")
    ```
  - **Incorrect**:
    ```pug
    button(on:click="{() => handleClick(param)}")
    button(on:click="{handleClick(param)}")
    div(class="{isActive ? 'active' : ''}")
    ```
# Key Design Patterns
## Atomic Design 
Components organized as `atoms/` → `molecules/` → `organisms/` (see `src/components/`)
## State Management
Svelte stores centralized in `src/stores/` with `dropItemRegistry` for advancement queuing
## Workflow State Machine
Finity FSM in `WorkflowStateMachine.js` handles character creation flow: `idle` → `creating_character` → `processing_advancements` → `selecting_equipment` → `shopping` → `selecting_spells` → `completed`
## FoundryVTT Hooks Integration
Module uses hooks extensively for FoundryVTT lifecycle and D&D 5e advancement system integration

# svelte-preprocess-pug Rules
## Indentation
- **Description**: In Pug templates, +else() statements must be nested within the related +if statement, indented one level deeper.
- **Examples**:
  - **Correct**:
    ```pug
    +if("condition")
      element
      +else()
        other-element
    ```
  - **Incorrect**:
    ```pug
    +if("condition")
      element
    +else()
      other-element
    ```

## Content
- **Description**: Content must always be contained within an element, never as a bare pipe beneath an +if statement.
- **Examples**:
  - **Correct**:
    ```pug
    +if("condition")
      span content here
    ```
  - **Incorrect**:
    ```pug
    +if("condition")
      | content here
    ```

## Conditional Logic
- **Description**: Only separate +if() and +else() statements are supported. Structure logic as separate conditional blocks.
- **Examples**:
  - **Correct**:
    ```pug
    +if("type === 'tool'")
      .tool-config
    +if("type === 'armor'")
      .armor-config
    +if("type === 'weapon'")
      .weapon-config
    ```
  - **Incorrect**:
    ```pug
    +if("type === 'tool'")
      .tool-config
    +else if("type === 'armor'")
      .armor-config
    +else if("type === 'weapon'")
      .weapon-config
    ```

## Event Handlers
- **Description**: Event handlers must use the != operator to prevent HTML encoding. Avoid arrow functions and the = operator.
- **Examples**:
  - **Correct**:
    ```pug
    button(on:click!="{handleClick(param)}")
    button(on:click!="{handleClick}")
    div(class!="{isActive ? 'active' : ''}")
    ```
  - **Incorrect**:
    ```pug
    button(on:click="{() => handleClick(param)}")
    button(on:click="{handleClick(param)}")
    div(class="{isActive ? 'active' : ''}")
    ```

# Foundry Rich Text / ProseMirror
## Use ProseMirror for rich descriptions instead of `<textarea>`
- **Description**: Foundry's standard editable rich text UI is ProseMirror via TyphonJS `TJSProseMirror`. Prefer it for biography, description, notes, and other HTML fields instead of plain textarea controls.
- **Implementation pattern from FFXIV**:
  - Define the backing data field as an `HTMLField` in the data model, e.g. `biography: new HTMLField()` in `src/models/actors/PC.js`.
  - Create a reusable molecule wrapper, e.g. `src/components/molecules/ProseMirror.svelte`.
  - Use `getContext("#doc")` so the editor reads and writes through the sheet's `TJSDocument` store.
  - Pass `options={{ document: $doc, fieldName: attr }}`, where `attr` is a dot path such as `system.biography`.
  - Bind `content` and `enrichedContent` through the wrapper.
- **FFXIV example usage**:
  ```pug
  h1.gold {localize("Description")}
  ProseMirror(classes="{proseMirrorClasses}" attr="system.description")
  h1.gold {localize("Notes")}
  ProseMirror(classes="{proseMirrorClasses2}" attr="system.biography")
  ```
- **Shop Studio guidance**:
  - For shop descriptions, replace `textarea.description-text` with a ProseMirror component bound to the shop actor's HTML field path, e.g. `system.details.biography` or the final chosen field path.
  - Keep `ShopfrontTab.svelte` stateless for persistence: pass the editor props and callback through `sharedProps`, but persist through `$documentStore.update(...)` or a dedicated document atom in `ShopSheet.svelte`.
  - Add component-level styling for the ProseMirror container rather than global `textarea` rules; Foundry's editor already owns the editing affordance.
  - Do not edit `dist/`; implement source changes under `src/components/` and related source files.
