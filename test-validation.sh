#!/bin/bash

echo "🧪 Testando validação de campos obrigatórios..."
echo ""

# Criar um arquivo temporário para simular entrada
echo "feat

test subject
n" > /tmp/test_input.txt

echo "📝 Teste 1: Subject vazio (deve mostrar erro de validação)"
echo "Entrada simulada:"
echo "- Tipo: feat"
echo "- Scope: (vazio)"
echo "- Subject: (vazio primeiro, depois 'test subject')"
echo "- Breaking change: n"
echo ""

# Executar o comando com entrada simulada
echo "Executando: node dist/cjs/cli/index.js commit < /tmp/test_input.txt"
node dist/cjs/cli/index.js commit < /tmp/test_input.txt

echo ""
echo "✅ Teste concluído!"
echo ""

# Limpar arquivo temporário
rm -f /tmp/test_input.txt

echo "📝 Teste 2: Verificando se as mensagens de validação estão funcionando"
echo "Para testar manualmente, execute:"
echo "node dist/cjs/cli/index.js commit"
echo ""
echo "E tente deixar o campo 'subject' vazio para ver a mensagem de erro."