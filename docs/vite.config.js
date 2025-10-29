import { defineConfig } from 'vite';

export default defineConfig({
  base: '/commitzero/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2018',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        installation: 'installation.html',
        configuration: 'configuration.html',
        usage: 'usage.html',
        api: 'api.html',
        examples: 'examples.html',
        contributing: 'contributing.html',
        faq: 'faq.html',
        changelog: 'changelog.html',
        // Portuguese pages
        'pt-br/index': 'pt-br/index.html',
        'pt-br/installation': 'pt-br/installation.html',
        'pt-br/configuration': 'pt-br/configuration.html',
        'pt-br/usage': 'pt-br/usage.html',
        'pt-br/api': 'pt-br/api.html',
        'pt-br/examples': 'pt-br/examples.html',
        'pt-br/contributing': 'pt-br/contributing.html',
        'pt-br/faq': 'pt-br/faq.html',
        'pt-br/changelog': 'pt-br/changelog.html',
        // Spanish pages
        'es/index': 'es/index.html',
        'es/installation': 'es/installation.html',
        'es/configuration': 'es/configuration.html',
        'es/usage': 'es/usage.html',
        'es/api': 'es/api.html',
        'es/examples': 'es/examples.html',
        'es/contributing': 'es/contributing.html',
        'es/faq': 'es/faq.html',
        'es/changelog': 'es/changelog.html'
      },
      output: {
        manualChunks(id) {
          if (id.includes('prismjs')) return 'prism';
        }
      },
      treeshake: true
    }
  },
  esbuild: {
    drop: ['console', 'debugger']
  },
  server: {
    port: 3000,
    open: true
  }
});