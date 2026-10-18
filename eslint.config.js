import js from '@eslint/js'
import pluginQuery from '@tanstack/eslint-plugin-query'
import prettier from 'eslint-config-prettier'
import boundaries from 'eslint-plugin-boundaries'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importX from 'eslint-plugin-import-x'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Feature-Sliced Design: a layer may import only from the layers below it.
// Slices of the same layer are isolated from each other.
const FSD_LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']
const SLICED_LAYERS = ['pages', 'widgets', 'features', 'entities']

const layersBelow = (layer) => FSD_LAYERS.slice(FSD_LAYERS.indexOf(layer) + 1)

const fsdPolicies = FSD_LAYERS.map((layer) => ({
  from: { element: { type: layer } },
  allow: {
    to: [
      ...layersBelow(layer).map((type) => ({ element: { type } })),
      SLICED_LAYERS.includes(layer)
        ? { element: { type: layer, captured: { slice: '{{from.element.captured.slice}}' } } }
        : { element: { type: layer } },
    ],
  },
}))

const PUBLIC_API_IMPORT_PATTERNS = [
  {
    group: SLICED_LAYERS.map((layer) => `@/${layer}/*/**`),
    message: 'Import the slice through its public API: @/<layer>/<slice>.',
  },
  {
    group: ['@/shared/*/*/**'],
    message: 'Import shared through its public API: @/shared/<segment>/<module>.',
  },
  {
    group: [
      '../**/app/**',
      '../**/pages/**',
      '../**/widgets/**',
      '../**/features/**',
      '../**/entities/**',
      '../**/shared/**',
    ],
    message: 'Use the @/ alias to import from another layer.',
  },
]

// PRD 11.0: the OS (notifications, devices, screen capture, autostart) is reached only through
// PlatformAdapter from @/shared/platform, so the Tauri build can swap the implementation.
const PLATFORM_MESSAGE = 'Use getPlatform() from @/shared/platform.'
const PLATFORM_ONLY_FILES = 'src/shared/platform/**'
const TAURI_IMPORT_PATTERN = { group: ['@tauri-apps/*'], message: PLATFORM_MESSAGE }
// livekit-client helpers that capture on their own, bypassing the adapter.
const LIVEKIT_CAPTURE_IMPORTS = {
  name: 'livekit-client',
  importNames: ['createLocalScreenTracks', 'createLocalTracks', 'createLocalVideoTrack'],
  allowTypeImports: true,
  message: `Capture through the platform adapter and publishTrack() the result. ${PLATFORM_MESSAGE}`,
}

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'src/shared/api/generated']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
      pluginQuery.configs['flat/recommended'],
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'import-x/no-default-export': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // Public API: slices are imported only through their index.ts,
      // shared only down to a segment (`@/shared/ui/button`).
      'no-restricted-imports': [
        'error',
        {
          paths: [LIVEKIT_CAPTURE_IMPORTS],
          patterns: [...PUBLIC_API_IMPORT_PATTERNS, TAURI_IMPORT_PATTERN],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [PLATFORM_ONLY_FILES],
    rules: {
      'no-restricted-globals': ['error', { name: 'Notification', message: PLATFORM_MESSAGE }],
      'no-restricted-properties': [
        'error',
        ...['navigator', 'window', 'globalThis', 'self'].flatMap((object) => [
          { object, property: 'mediaDevices', message: PLATFORM_MESSAGE },
          { object, property: 'Notification', message: PLATFORM_MESSAGE },
        ]),
        // Catches calls on an aliased mediaDevices too.
        ...['getUserMedia', 'getDisplayMedia', 'enumerateDevices'].map((property) => ({
          property,
          message: PLATFORM_MESSAGE,
        })),
      ],
    },
  },
  {
    files: [PLATFORM_ONLY_FILES],
    rules: {
      'no-restricted-imports': ['error', { patterns: PUBLIC_API_IMPORT_PATTERNS }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      // Global type declarations do not belong to any layer.
      'boundaries/ignore': ['src/*.d.ts'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**', partialMatch: false },
        ...SLICED_LAYERS.map((type) => ({
          type,
          pattern: `src/${type}/*/**`,
          partialMatch: false,
          capture: ['slice'],
        })),
        { type: 'shared', pattern: 'src/shared/**', partialMatch: false },
      ],
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      'boundaries/dependencies': ['error', { default: 'disallow', policies: fsdPolicies }],
      'boundaries/no-unknown-files': 'error',
    },
  },
  {
    // TanStack Virtual is the PRD's choice for long lists, and its hook returns
    // functions React Compiler refuses to memoize: the list below opts out of
    // compilation instead of giving up virtualization.
    files: ['src/widgets/channel-chat/ui/ChannelChat.tsx'],
    rules: { 'react-hooks/incompatible-library': 'off' },
  },
  {
    // Tooling configs are required to use default exports.
    files: ['*.config.{js,ts}', 'scripts/**', 'e2e/global-setup.ts'],
    rules: { 'import-x/no-default-export': 'off' },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  prettier,
])
