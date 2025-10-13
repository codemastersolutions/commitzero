import { defineConfig } from 'vite';

export default defineConfig({
  base: '/commitzero/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: 'index.html',
        installation: 'installation.html',
        configuration: 'configuration.html',
        usage: 'usage.html',
        'api-reference': 'api-reference.html',
        examples: 'examples.html',
        contributing: 'contributing.html',
        faq: 'faq.html',
        changelog: 'changelog.html',
        // Portuguese pages
        'pt-br/index': 'pt-br/index.html',
        'pt-br/installation': 'pt-br/installation.html',
        'pt-br/configuration': 'pt-br/configuration.html',
        'pt-br/usage': 'pt-br/usage.html',
        'pt-br/api-reference': 'pt-br/api-reference.html',
        'pt-br/examples': 'pt-br/examples.html',
        'pt-br/contributing': 'pt-br/contributing.html',
        'pt-br/faq': 'pt-br/faq.html',
        'pt-br/changelog': 'pt-br/changelog.html',
        // Spanish pages
        'es/index': 'es/index.html',
        'es/installation': 'es/installation.html',
        'es/configuration': 'es/configuration.html',
        'es/usage': 'es/usage.html',
        'es/api-reference': 'es/api-reference.html',
        'es/examples': 'es/examples.html',
        'es/contributing': 'es/contributing.html',
        'es/faq': 'es/faq.html',
        'es/changelog': 'es/changelog.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});