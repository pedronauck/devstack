# Corrigir o Scaffold TanStack e Blindar a Geração

## Summary

- Corrigir quatro causas raiz no scaffold TanStack: `tsconfig` incompleto no app gerado, ausência de geração explícita do `routeTree.gen.ts` antes do `typecheck`, tipagem incorreta no health check e falta de validação de formatação do que realmente é gerado.
- Manter o comportamento do scaffold, mas alinhar a saída às expectativas atuais de TanStack Router/Start, Vite e ao contrato de qualidade do repositório.

## Key Changes

- Ajustar o builder TanStack em `src/builders/tanstack-start.ts` para gerar um `packages/app/tsconfig.json` com `allowImportingTsExtensions: true` e `types: ["vite/client"]`, além de preservar o modo `bundler` já usado no projeto.
- Gerar uma `packages/app/src/routeTree.gen.ts` inicial e válida diretamente no scaffold, incluindo as rotas opcionais de módulos (`auth`, `stripe`, `inngest`), para que o app typecheck passe imediatamente sem depender do CLI; deixar o TanStack Start/Vite cuidar de futuras atualizações da árvore durante `dev`/`build`.
- Corrigir o health route gerado para usar um objeto `checks` mutável com tipo de união real, em vez de `satisfies` estreito que congela `postgres` como `"ok"` e quebra a atribuição posterior.
- Manter o estilo atual de imports com extensão `.ts` e alinhar a configuração do compilador a esse estilo, em vez de reescrever imports como remendo.
- Corrigir a raiz do problema de formatação no ponto de origem: ajustar emissores JSON em `src/builders/shared.ts` para o estilo aceito pelo `oxfmt` e reformatar os arquivos/copiados e builders dinâmicos que hoje falham em `oxfmt --check`, incluindo assets copiados do frontend, `request.ts` compartilhado e arquivos gerados de config/metadata do workspace.

## Validation

- Adicionar uma validação rápida de scaffold dentro do pipeline normal de testes: gerar temporariamente os stacks `separated` e `tanstack-start`, rodar `oxfmt --check` sobre a saída gerada e validar que o scaffold TanStack contém a `routeTree.gen.ts` correta e os campos corrigidos no `tsconfig`.
- Adicionar um smoke validator pesado em `bin/`, fora do caminho padrão do `make check`, para gerar um app TanStack temporário, executar `bun install`, `bun run lint` e `bun run typecheck` no projeto gerado, falhando com saída clara em qualquer etapa.
- Integrar a validação rápida ao `make check` e expor a validação pesada como script dedicado de `package.json` e etapa explícita de CI.

## Test Plan

- Manter os testes atuais de estrutura e módulos.
- Adicionar testes que falhem no estado atual e passem somente com a correção do builder.
- Cobrir explicitamente estes cenários: imports `.ts` aceitos no app gerado, import `styles.css?url` resolvido via tipos do Vite, `typecheck` funcionando com a `routeTree.gen.ts` já presente no scaffold e saída do scaffold passando em `oxfmt --check`.
- Validar o fluxo real do app TanStack gerado com o smoke test: gerar, instalar dependências, checar formatação e rodar `typecheck`.

## Assumptions

- Política confirmada: validação rápida entra no `make check`; validação pesada fica em script/CI dedicado para não degradar o ciclo local.
- A cobertura pesada inicial será do `tanstack-start`, que é o caminho atualmente quebrado; a cobertura rápida de geração/formatação cobre ambos os stacks.
- Não haverá workaround: nada de `@ts-ignore`, nada de suprimir lint/typecheck e nada de “rodar build antes do typecheck” como solução permanente.
