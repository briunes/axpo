# TODO

Criado em: 15 de abril de 2026
Origem: notas de Henrique Torres (Ontem 21:12 e 21:27)

## Tarefas

- [x] Ações de download de PDF.
- [x] Templates de email.
- [x] Criar componente centralizado de morada com país/província alinhados com ISO de países (usar biblioteca React existente). Exemplo citado: gestão de agência.
- [x] Adicionar helper internacional para inputs de telefone/telemóvel (indicativo + bandeira).
- [x] Rever na gestão de utilizadores o propósito de ter `email` + `email comercial`.
- [x] Alterar o campo `other details` (optional notes) para textarea na gestão de utilizadores (WYSIWYG/comentários fica para futuro).
- [x] Garantir que campos tipo select usam componente com pesquisa para facilitar/limitar seleção de registos.
- [x] Na gestão de utilizadores, implementar senha aleatória com medidor de força e opção de gerar nova senha.
- [x] Na gestão de utilizadores, após save, remover destaque desnecessário ao PIN como "não visível novamente" (PIN é visível e alterável pelo próprio utilizador).
- [x] Na gestão de clientes, corrigir auditoria `created/updated` para utilizador com perfil agente (está a gravar `system` em vez do utilizador autenticado).
- [ ] Nas simulações, implementar OCR de faturas para preenchimento automático do máximo possível.
- [ ] Pedir exemplos de faturas no próximo PDS/demo para testes de OCR (amanhã).


- [x] No formulário de simulação, adicionar opção de escolher CUPS anteriormente definidos (lookup de CUPS já associados ao cliente selecionado ou ao histórico).
- [x] Garantir que os CIFs ficam livres (sem restrição de unicidade forçada, ou permitir reutilização entre clientes/agências distintas).
- [x] Excesso de potência só pode ter um único campo (como no Excel); garantir que a fórmula de cálculo aplica correctamente esta restrição — rever mapeamento no simulador.
- [x] Quando se seleciona cliente no simulador, pré-preencher automaticamente todos os dados do cliente (nome, morada, CUPS, contacto, etc.) a partir da gestão de clientes — não deve ser necessário voltar a preencher.
