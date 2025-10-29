import { t } from './dist/esm/i18n/index.js';

console.log('Testando função de tradução:');
console.log('EN:', t('en', 'commit.git.added'));
console.log('PT:', t('pt', 'commit.git.added'));
console.log('ES:', t('es', 'commit.git.added'));
console.log('Chave inexistente:', t('pt', 'chave.inexistente'));