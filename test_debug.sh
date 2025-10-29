#!/bin/bash

# Script para testar o comando commit com debug
echo "Testando comando commit --add..."
echo "Arquivos unstaged:"
git diff --name-only

echo -e "\nExecutando comando:"
{
  echo "feat"           # tipo
  echo ""               # escopo (vazio)
  echo "test commit"    # assunto
  echo ""               # corpo (vazio)
  echo "n"              # breaking change (não)
} | pnpm commitzero commit --add 2>&1 | head -20