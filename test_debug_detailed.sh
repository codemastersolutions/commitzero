#!/bin/bash

echo "=== TESTE DETALHADO COM DEBUG ==="

echo "Configuração atual:"
cat commitzero.config.json

echo -e "\nArquivos unstaged:"
git diff --name-only

echo -e "\nExecutando comando commit --add com debug:"
echo -e "feat\ntest\nTeste de debug\n\nn\n" | pnpm commitzero commit --add 2>&1 | head -30