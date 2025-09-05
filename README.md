# FoundryVTT Module Template

A modern FoundryVTT module template with Svelte, TypeScript, and Vite.

## Quick Start

1. **Create a new repository from this template**
   - Click "Use this template" on GitHub
   - Choose your repository name (this will become your module ID)

2. **Run the setup script**
   ```bash
   ./setup.sh
   ```
   This will automatically replace all placeholders with values based on your repository name.

3. **Install dependencies and start developing**
   ```bash
   bun install
   bun run dev
   ```

## Manual Setup (Alternative)

If you prefer to set up manually or the script doesn't work:

1. Replace the following placeholders in your files:
   - `<MODULE_ID>` → Your module ID (e.g., "my-awesome-module")
   - `<MODULE_TITLE>` → Your module title (e.g., "My Awesome Module")
   - `<MODULE_DESCRIPTION>` → Your module description
   - `<MODULE_LOG_PREFIX>` → Your log prefix (e.g., "MAM")

2. Update the author information in `module.json` and `package.json`

3. Update the GitHub URLs in `module.json` to point to your repository

## Features

- ⚡ **Vite** for fast development and building
- 🎨 **Svelte** for reactive UI components
- 📝 **TypeScript** for type safety
- 🔧 **ESLint** and **Prettier** for code quality
- 🎯 **Hot Module Replacement** for instant development feedback
- 📦 **Modern ES modules** with proper imports

## Development

- `bun run dev` - Start development server with HMR
- `bun run build` - Build for production
- `bun run eslint` - Run ESLint

## Template Variables

The template uses the following variables that get replaced during setup:

- `MODULE_ID`: The module identifier (from repository name)
- `MODULE_TITLE`: Human-readable module title
- `MODULE_DESCRIPTION`: Module description
- `MODULE_LOG_PREFIX`: Short prefix for logging (derived from title)
