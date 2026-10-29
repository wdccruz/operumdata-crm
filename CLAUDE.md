# Instruções para assistentes de IA

## Idioma
- Responder sempre em **português do Brasil**: mensagens, resumos, relatórios, instruções e passos de configuração.
- Commits, comentários de código e documentação também em português, seguindo o padrão do projeto.
- A interface do CRM continua bilíngue (pt-BR padrão e en-US). Textos novos da interface devem ter tradução em `src/locales/en-US.ts`; `npm test` falha se faltar alguma.

## Projeto
- CRM da OperumData: React + Vite no GitHub Pages (https://wdccruz.github.io/operumdata-crm/) e Supabase (PostgreSQL, Auth e RLS) como backend.
- Push em `main` publica o site automaticamente pelo workflow `.github/workflows/pages.yml`.
- Mudanças no banco entram apenas como migrations incrementais em `supabase/migrations/`. Nunca apagar dados nem recriar o banco.
- Antes de publicar, rodar: `npm test`, `npm run test:db`, `npm run test:ui` e `npm run build`.
- Nunca versionar senhas, tokens, chaves `service_role` ou arquivos `.env`.
