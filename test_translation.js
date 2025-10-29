// Teste simples para verificar se a tradução está funcionando
import { t } from './dist/esm/i18n/index.js';

console.log('Testando tradução:');
console.log('Lang: pt');
console.log('Key: commit.git.added');
console.log('Result:', t('pt', 'commit.git.added'));
console.log('Expected: Arquivos adicionados à área de staging.');

console.log('\nTestando outras chaves:');
console.log('commit.select.type:', t('pt', 'commit.select.type'));
console.log('commit.chosen.type:', t('pt', 'commit.chosen.type', { type: 'feat' }));