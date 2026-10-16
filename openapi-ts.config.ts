import { defineConfig } from '@hey-api/openapi-ts'

// Generates the orbit-server client from the spec snapshot in api/.
// Runs automatically before dev, build, typecheck, lint and test; the output is not committed.
export default defineConfig({
  input: './api/orbit-server.openapi.yaml',
  output: 'src/shared/api/generated',
  plugins: [
    '@hey-api/typescript',
    { name: '@hey-api/transformers', dates: true },
    { name: '@hey-api/sdk', transformer: true },
    {
      name: '@hey-api/client-fetch',
      throwOnError: true,
      // Path is relative to this config file.
      runtimeConfigPath: './src/shared/api/client-config.ts',
    },
    { name: '@tanstack/react-query', queryOptions: true, mutationOptions: true },
  ],
})
