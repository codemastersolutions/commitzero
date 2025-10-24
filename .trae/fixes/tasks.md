1 - [ ] Exibir o header antes de qualquer mensagem, atualmente a pergunta `No files are staged. Run 'git add -A' now?` é exibida antes do header `CommitZero CLI <version>`

2 - [ ] Ao executar o comando `commitzero commit -a`, executar o comando `git add -A` automaticamente, caso não tenha arquivos modificados, prosseguir com o commit

3 - [ ] Ao executar o comando `commitzero commit -p`, verificar se há arquivos em staged, caso não tenha, exibir a pergunta `No files are staged. Run 'git add -A' now?`, caso tenha e não tenha arquivos modificados, prosseguir com o commit e após o commit e se não houver erros, execute o comando `git push`

4 - [ ] Nas opções `Scope`, `Subject` e `Body`, exiba a quantidade de caracteres digitados e o máximo permitido, caso ultrapasse o máximo, mude a cor para vermelho e impedir a continuação do commit sem terminar o processo, para que o usuário corrija o texto antes de prosseguir

5 - [ ] Adicione loading enquanto o commit e/ou push está sendo feito, para que o usuário saiba que o processo está sendo executado
