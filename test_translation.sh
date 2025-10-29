#!/bin/bash

# Script para testar a tradução
echo "Testando tradução..."
echo "Configuração atual:"
cat commitzero.config.json

echo -e "\nTestando comando simples:"
pnpm commitzero --help | head -5