#!/bin/bash

# Teste final da mensagem commit.git.added
echo "=== TESTE FINAL DA MENSAGEM commit.git.added ==="
echo "Configuração atual:"
cat commitzero.config.json

echo -e "\nArquivos unstaged:"
git diff --name-only

echo -e "\nExecutando comando commit --add:"
echo "feat" | pnpm commitzero commit --add 2>&1 | grep -E "(commit\.git\.added|Arquivos adicionados|Files added)" || echo "Mensagem não encontrada"