#!/bin/bash

echo "=== TESTE VERBOSO COM DEBUG ==="

echo "Configuração atual:"
cat commitzero.config.json

echo -e "\nArquivos unstaged:"
git diff --name-only

echo -e "\nExecutando comando commit --add com debug (sem filtro):"
echo -e "feat\ntest\nTeste de debug\n\nn\n" | pnpm commitzero commit --add