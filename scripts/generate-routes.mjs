// Generates src/routeTree.gen.ts from src/routes/** without starting a dev server.
// The @tanstack/router-plugin Vite plugin does this automatically on `vite dev` /
// `vite build`, but `tsc -b` (which runs first in `npm run build`) needs the file
// to already exist, so this script runs ahead of it.
import { Generator, getConfig } from '@tanstack/router-generator'

const root = process.cwd()
const config = getConfig(
  {
    routesDirectory: './src/routes',
    generatedRouteTree: './src/routeTree.gen.ts',
  },
  root,
)

const generator = new Generator({ config, root })
await generator.run()
console.log('✓ generated src/routeTree.gen.ts')
