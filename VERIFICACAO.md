# Verificação da implantação — OperumData CRM

Data: 29/10/2026, horário de Brasília.

## Acesso confirmado

**URL publicada: https://operumdata-crm.blondseed19.chatgpt.site/**

Hospedagem privada por proprietário via Sites, seguida do login Supabase do CRM. A entrada privada com a conta ChatGPT proprietária e a tela real do CRM foram verificadas no navegador. O login e a consulta de leads na URL publicada também foram testados automaticamente com contas sintéticas, sem simular a API Supabase. O proprietário definiu sua senha e sua sessão como administrador foi confirmada na aplicação local.

Código: repositório **privado** https://github.com/wdccruz/operumdata-crm, branch `main`.

## Supabase configurado

- Organização: OperumData. Projeto existente: `operumdata-crm`. Região: East US (Ohio).
- Referência pública do projeto: `lpmzgbsvswnlxomaoyzj`. Nenhum outro projeto Supabase foi criado.
- Seis migrations aplicadas e registradas em `supabase_migrations.schema_migrations`.
- 16 tabelas públicas com RLS habilitada e 42 políticas. Schema `private` não exposto na Data API.
- Privilégios de cliente mínimos; chave de servidor também recebeu privilégios SQL explícitos na sexta migration.
- Cadastro público desabilitado, login anônimo desabilitado, provedor e-mail ativo, senha mínima de 12 caracteres.
- Site URL e redirect de produção: URL publicada acima. Redirects locais exatos também autorizados.
- `manage-users` implantada, com verificação JWT da plataforma habilitada, `getUser()` e perfil administrador ativo verificados no código. `APP_URL` aponta para produção. CORS responde somente com a origem canônica, sem o caminho de URL.
- URL e chave pública configuradas em `.env.local` ignorado e em variáveis públicas do GitHub Actions. Nenhuma chave administrativa no frontend, GitHub ou arquivos versionados.

## Testes executados

| Comando / contexto | Resultado |
| --- | --- |
| `npm test` | 7 testes de domínio passaram |
| `npm run test:db` | 35 testes PostgreSQL/RLS passaram em PGlite |
| `npm run test:ui` | 2 cenários desktop/celular passaram com API simulada |
| `node scripts/test-hosted.mjs` | 13 validações no Supabase real e na URL publicada passaram |
| `npm run build` com base `/` | Build de produção para Sites aprovado |
| `npm audit` | Nenhuma vulnerabilidade detectada na árvore instalada |

Validações reais: acesso anônimo bloqueado; cadastro público bloqueado; login de administrador e dois prospectores; função de convites rejeitando anônimo e prospector; JWT/CORS de administrador; empresa, lead e contato persistidos; ligação, tarefa e reunião; atualização com histórico; isolamento de leitura e escrita entre agentes; contratos e avaliações restritos; promoção de perfil negada; login e leitura pela interface publicada; persistência após sair e entrar novamente.

As contas e os registros operacionais sintéticos foram removidos ao final. A auditoria de alterações sintéticas continua sendo histórico, sem entrar nos indicadores comerciais. Não foram inseridos dados reais de empresas nos testes. Relatório JSON e screenshots locais ficam em `artifacts/homologacao/`, ignorados pelo Git. O acesso técnico da hospedagem usado nos testes foi transmitido apenas por stdin sem eco e apenas para a origem do Site; não faz parte do frontend.

## Publicação

GitHub Pages foi rejeitado pelo GitHub com HTTP 422 porque o plano atual não suporta o repositório privado. O código foi mantido privado. A alternativa Sites foi publicada privadamente, sem expor dados comerciais.

- Site: `appgprj_6ae3a65dd0d88191a856955196597deb`.
- Versão: `appgprj_6ae3a65dd0d88191a856955196597deb~appgver_15b5755508a88191a6e7136106cb1349`.
- Deployment: `appgdep_6ae3a6bcdc50819180b11e2abb6c26cf`.
- Resultado da plataforma: `succeeded`.
- Checkout de publicação separado: `../operumdata-crm-hosting`; identidade e assets estáticos, sem base comercial.

O workflow GitHub valida o código; Pages permanece desabilitado. Alterações futuras precisam ser publicadas no Sites explicitamente, pois um push ao GitHub não atualiza o Site automaticamente.

## Configurações para ampliar o uso

O acesso do proprietário está pronto. Para a equipe, configurar visualizadores autorizados da hospedagem privada e convites/perfis no CRM. Configurar SMTP próprio no Supabase antes de convidar destinatários externos: o e-mail padrão limita destinatários e volume. Definir política de retenção, backup e testar restauração externa antes de importar base comercial de produção.

Agenda interna é cronológica; CSV importa os campos essenciais; horas gravadas/aceitas têm estrutura preparada, sem ERP ou vídeos. Listagem carrega dados autorizados em lotes, com paginação visual; volumes maiores exigirão agregações e filtros no servidor. Esses limites estão descritos no README.
