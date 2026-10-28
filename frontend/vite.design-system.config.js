import { defineConfig, mergeConfig } from 'vite'
import config from './vite.config.js'

// Independent preview build; the production app entry and router are unchanged.
export default mergeConfig(config, defineConfig({
  build: { outDir: 'dist/design-system', rollupOptions: { input: 'design-system.html' } },
}))
