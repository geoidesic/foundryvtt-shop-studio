# Foundryvtt Shop Studio

Easily create shop actors for your PCs to interact with in-game

# User

## Game Master

### Installation

1. In FoundryVTT, open the **Add-on Modules** tab in the sidebar and click **Install Module**.
2. Search for **Shop Studio** and click **Install**.
3. Enable the module in your world settings (**Game Settings → Manage Modules**).

### Create a shop

The easiest way is the **Shop Studio button** in the Actors sidebar header (added by the module by default):

1. Open the **Actors** directory in the sidebar.
2. Click the **Shop Studio** button (the dragon logo) in the directory header.
3. A new shop named `Shop N` (incrementing automatically) is created and opened immediately with its custom Shop sheet.

Prefer the manual route? You can also use the standard **Create Actor** dialog:

1. In FoundryVTT, open the **Create Actor** dialog (sidebar → Actors → Create Actor, or the `+` button).
2. Select the **Shop** type (added by Shop Studio).
3. Give it a name and click **Create**. The shop opens with its custom Shop sheet.

> The sidebar button can be hidden via the **Show Button in Sidebar** module setting if you'd rather use the dialog only.

Because a shop is a normal actor underneath, you can drop it on a scene as a token, file it in a folder, or duplicate it to spin up a second location.

#### Let players access the shop

A shop is still an actor, so players can only open it if they have permission. To let a player (or the whole party) use the shop, grant them **Limited** permission on the actor:

1. Right-click the shop actor in the **Actors** directory and choose **Permissions** (or open the actor's permission configuration).
2. Set the desired player (or the **Default** role) to **Limited**.

**Limited** is all that's needed — it lets players open the shop's storefront and basket without being able to edit the shop's stock or settings. Without it, the shop won't appear or open for them.

### Provision a shop (three ways)

All three methods save the stock to the actor, so it persists when you reopen the sheet. Open the shop's **Settings** tab and expand the **Provisioning** section to choose a method.

#### 1. Drag & drop (manual curation)

- Open the shop sheet as GM and go to the **Inventory** tab **OR** open any compendium containing items you want to add to the inventory.
- Drag items directly from the **Items sidebar** or from the open **compendium** onto the inventory.
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

### Targeting — who is "the shopper"?

Every basket, sale, and purchase is tied to a **target actor** — the character the shop is currently interacting with. Both GMs and players pick this actor from the **actor selector** at the top of the **Basket** tab. The selection is persisted per-user per-shop and restored automatically when the sheet reopens.

As GM, the selector is populated from **two live sources**, merged together:

1. **Token targets** — any actor whose token the GM currently has targeted on the canvas (`game.user.targets`). This is live: targeting or untargeting a token immediately updates the dropdown via the `targetToken` hook. No extra click required.
2. **Registered targets** — actors the GM (or a player) has previously selected, stored on the shop actor under the `targetedActors` flag.

When the GM picks an actor from the dropdown, `selectTargetActor` writes it to the `targetedActors` flag (source `gm-selection`), so it persists for the session and is visible to players browsing that shop.

The GM can therefore shop **on behalf of any character** — buy items into that character's inventory, or sell items out of it — simply by switching the target actor. This is how a GM runs a transaction for a player who isn't at the table, or pre-stocks a PC's basket.

### Vendor funds

The shop tracks a system-agnostic **vendor wallet** (denomination map) in the `vendorFunds` flag. It is seeded from the **Default Vendor Funds** world setting the first time it is read. **Buys credit** the wallet; **sells debit** it. If a sale would take the wallet negative, the sale is refused ("Shop cannot afford this sale"). GMs can view and edit the wallet in the shop's **Settings → Vendor Funds** section.

### Link a shopkeeper

In the shop's settings, add **Associated NPCs** (shopkeeper actors). Linked actors can be opened directly from the sheet.

### Edit the storefront description

Use the rich-text description editor on the shop sheet for lore, signage, or house rules. It's shown to players on the storefront.

### System-agnostic currency

Shop Studio reads currency from the active system (explicit support for **dnd5e** and **PF2e**, with a sensible fallback elsewhere), so the same workflow carries across campaigns.

## Player

### Shopping at a shop

Players see a clean storefront with a **basket** they fill themselves. Purchases deduct the correct currency from the buying character. Baskets and inventory sync live across connected clients over sockets; each shopper keeps their own basket, stored per-target on the shop actor. A GM can also buy on a player's behalf and view any player's current basket.

### Targeting — selecting your character

The actor selector at the top of the **Basket** tab lists **only characters you own** (`a.isOwner`). You cannot target another player's character or an NPC you don't own.

Selecting an actor registers it on the shop (`targetedActors`, source `player-selection`) and persists the choice (the `selectedActor.<shopId>` user flag). On reopen, your last selection is restored and re-registered. The selected actor is the character whose **currency is spent on buys** and **whose items are sold**.

> **Why targeting matters for selling:** the sell flow validates that the dropped item's owning actor matches the selected target actor. If they don't match, the sale is refused. Always make sure you have the correct character selected before dragging items in.

### Selling items to the vendor

Players can sell items from their character's inventory directly to the shop. This is the inverse of buying and is fully supported alongside purchases in the same basket.

#### How to sell

1. **Select the character** you are selling as (Basket tab → actor selector). This must be a character you own.
2. **Drag an item** from that character's sheet (or inventory) onto the **Sell Zone** drop area in the Basket tab. There are two sell zones — one shown when the basket is empty, and one below the basket table.
3. **Confirm quantity** (see below). The item is added to the basket as a **sell entry** (tagged `Sell`), distinct from buy entries.
4. Click **Sell Now**. The request is sent over the socket to the GM client (or resolved locally if a GM is acting), where it is applied authoritatively:
   - The quantity is removed from your character (or the item is deleted if fully sold).
   - A copy is added to the shop's stock.
   - The shop's **vendor funds are debited** by the sell total, and your character is **credited** that currency.
   - A `sell` transaction is appended to the shop's transaction log.

#### Quantity confirmation

Controlled by the world setting **Sell Quantity Mode** (`sellQuantityMode`), configured by the GM:

- **Prompt** (default): a dialog asks how many to sell.
  - If the item has only **1 in stock**, the dialog is skipped and it sells immediately.
  - Otherwise the dialog shows `−` / `+` steppers (clamped to available stock), an **All** button to sell the whole stack, and a **Confirm** button. The dialog respects the Foundry dark/light theme.
- **Default to 1**: the item is added at quantity 1 with no prompt.

#### Resolution mode

Controlled by the world setting **Sell Resolution Mode** (`sellResolutionMode`, default `gm`), configured by the GM:

- **GM**: your sell requests are queued and applied by a connected GM client. The GM is the single authority that moves items and currency, which prevents selling items you don't own or cheating the vendor funds.
- **Player**: sells are resolved on your own client. Use only in trusted games.

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