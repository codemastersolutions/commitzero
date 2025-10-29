#!/bin/bash

# Script para testar o comando commit interativo
{
  echo "feat"           # tipo
  echo ""               # escopo (vazio)
  echo "test commit"    # assunto
  echo ""               # corpo (vazio)
  echo "n"              # breaking change (não)
} | pnpm commitzero commit --add