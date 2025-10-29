#!/bin/bash

echo "=== TESTE SIMPLES DEBUG ==="

echo "Arquivos unstaged:"
git diff --name-only

echo -e "\nExecutando apenas o comando para ver a mensagem:"
echo -e "\n" | pnpm commitzero commit --add 2>&1 | grep -E "(DEBUG|commit\.git\.added|Arquivos adicionados)"