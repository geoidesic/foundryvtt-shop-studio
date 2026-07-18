# Foundryvtt Shop Studio

Easily create shop actors for your PCs to interact with in-game

# User

## Installation

1. Download the module from the [latest release](https://github.com/geoidesic/foundryvtt-shop-studio/releases/latest)
2. Extract the zip file to your FoundryVTT  directory
3. Restart FoundryVTT
4. Enable the module in your world settings

## License

No license is granted. All rights reserved.

## How To

### Create a shop

1. In FoundryVTT, open the **Create Actor** dialog (sidebar → Actors → Create Actor, or the `+` button).
2. Select the **Shop** type (added by Shop Studio).
3. Give it a name and click **Create**. The shop opens with its custom Shop sheet.

Because a shop is a normal actor underneath, you can drop it on a scene as a token, file it in a folder, or duplicate it to spin up a second location.

### Provision a shop (three ways)

All three methods save the stock to the actor, so it persists when you reopen the sheet. Open the shop's **Settings** tab and expand the **Provisioning** section to choose a method.

#### 1. Drag & drop (manual curation)

- Open the shop sheet as GM and go to the **Inventory** tab.
- Drag items directly from the **Items sidebar** or from a **compendium** onto the inventory.
- Best for hand-picking a small, deliberate stock or topping a shop up between sessions.

#### 2. Compendium provisioning (auto-fill by type)

1. **Configure item sources** (once, world-wide):
   - Open **Module Settings → Shop Studio → Item Sources** (the `itemSources` menu).
   - Tick the **compendium packs** you want Shop Studio to draw from.
   - Optionally restrict which item types are listable via **Listable Item Types** (`listableItemTypes`). If left unset, all current item types are allowed.
2. **In the shop's Settings tab → Provisioning section:**
   - Toggle the provisioning mode to **Compendium** (the toggle shows "Provision by Compendium" when active).
   - For each item type you want stocked, set a **quantity** (e.g. 5 weapons, 12 consumables, 3 armor). Quantities persist to the actor immediately.
3. Click **Provision Store**. Shop Studio draws random items of those types from your configured compendiums, up to the totals you set, and stacks duplicates.

> Tip: If no compendiums are configured, or no item types have a quantity greater than zero, provisioning warns you and does nothing.

#### 3. Roll tables (themed, weighted stock)

1. In the shop's **Settings** tab → **Provisioning** section, leave the mode on **Roll Table** (the default).
2. Drag one or more **roll tables** from the Roll Tables sidebar onto the drop zone.
3. Set the **per-table roll count** for each table (how many times it should be rolled).
4. Click **Provision Store**. Shop Studio rolls the tables, resolves each result into a real item, and **stacks duplicates** (three potion hits become one row with quantity 3). Re-provision any time to refresh stock.

### Set per-shop pricing

Each shop has two sliders (50%–200%) in the **Settings → Pricing** section:

- **Sale Price Factor** — what buyers are charged.
- **Buy Price Factor** — what the shop pays when buying from a character.

Set them once per shop (e.g. an expensive frontier trading post vs. a lowballing back-alley fence). Values save to the actor.

### Let players shop

- **Players** see a clean storefront with a **basket** they fill themselves. Purchases deduct the correct currency from the buying character.
- **GMs** can buy on a player's behalf and view any player's current basket.
- Baskets and inventory sync live across connected clients over sockets; each shopper keeps their own basket, stored per-target on the shop actor.

### Link a shopkeeper

In the shop's settings, add **Associated NPCs** (shopkeeper actors). Linked actors can be opened directly from the sheet.

### Edit the storefront description

Use the rich-text description editor on the shop sheet for lore, signage, or house rules. It's shown to players on the storefront.

### System-agnostic currency

Shop Studio reads currency from the active system (explicit support for **dnd5e** and **PF2e**, with a sensible fallback elsewhere), so the same workflow carries across campaigns.

# Developer

This module is built using the TyphonJS framework with Svelte.

## Prerequisites

- Node.js 18+
- Bun (recommended) or npm

## Setup

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

## Building

```bash
# Build for production
bun run build
```