import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';

const foundryGlobals = {
  Actor: 'readonly',
  ActiveEffect: 'readonly',
  Application: 'readonly',
  CONFIG: 'readonly',
  CONST: 'readonly',
  Dialog: 'readonly',
  FilePicker: 'readonly',
  FormApplication: 'readonly',
  Hooks: 'readonly',
  Item: 'readonly',
  RollTable: 'readonly',
  TextEditor: 'readonly',
  TokenHUD: 'readonly',
  TypeDataModel: 'readonly',
  foundry: 'readonly',
  fromUuid: 'readonly',
  fromUuidSync: 'readonly',
  game: 'readonly',
  getOwners: 'readonly',
  ui: 'readonly',
  $: 'readonly',
};

export default [
  {
    ignores: [
      'dist/**',
      '.vite-cache/**',
      'node_modules/**',
      'style.css',
      'src/hud/ShopTokenHUD.js',
    ],
  },
  js.configs.recommended,
  ...svelte.configs['flat/base'],
  {
    files: ['**/*.{js,mjs,ts,svelte}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...foundryGlobals,
      },
    },
    rules: {
      'no-dupe-keys': 'warn',
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-useless-escape': 'warn',
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        svelteConfig: {
          preprocess: sveltePreprocess(),
        },
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'svelte/comment-directive': 'error',
      'svelte/system': 'error',
      'svelte/valid-compile': 'warn',
      'svelte/valid-style-parse': 'off',
    },
  },
];
