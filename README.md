# OperumData CRM

CRM comercial da OperumData para prospecção e acompanhamento de parceiros. Primeiro comprador configurado: Praxis Robotics. Código e infraestrutura são independentes de outros projetos. **Dados comerciais ficam no PostgreSQL do Supabase; GitHub recebe somente código.**

## Estado da entrega

Frontend implementado, migrations SQL e regras de acesso testáveis, função de convites e publicação preparada. Não há credenciais ou projeto Supabase configurado neste repositório. Sem essas variáveis a aplicação mostra uma tela de configuração, sem dados simulados. A homologação de login, envio de convites e persistência via API no Supabase hospedado depende da configuração abaixo. Os testes de navegador usam uma API simulada explicitamente; os testes de RLS executam as migrations em PostgreSQL real embarcado (PGlite), com um adaptador mínimo para `auth.uid()`.

## Arquitetura

- React 19 + TypeScript, Vite, Tailwind 4 e CSS institucional. Ícones Lucide, CSV com PapaParse.
- `src/db.ts`: Supabase Auth, leitura paginada e gravação no PostgREST. Sessão em `sessionStorage`, sem banco no navegador. Encerrar a sessão ou fechar o navegador não exclui registros no servidor.
- `src/domain.ts`: indicadores, CNPJ, duplicatas, faixa de participantes e eventos externos.
- `src/CsvImport.tsx`: importação com prévia, mapeamento e relatório.
- `src/Editor.tsx`: formulários reutilizáveis com validação, mensagens e bloqueio durante salvamento.
- `src/App.tsx`: navegação, ficha por abas e módulos comerciais. `src/style.css`: tema e responsividade.
- `supabase/migrations`: esquema normalizado, índices, privilégios, RLS, auditoria e triggers de integridade. Aplique todos os arquivos na ordem do nome.
- `supabase/functions/manage-users`: convite administrativo. A chave `service_role` existe exclusivamente no servidor.
- `scripts/test-db.mjs`: integração PostgreSQL/RLS com contas sintéticas.
- `tests`: regras de domínio e fluxos de navegador desktop/celular.
- `.github/workflows/pages.yml`: testes, build e publicação do frontend em Pages.

Não há vídeos, cobranças automáticas, integrações pagas, projeções como resultados nem envio de mensagens em massa. `production` prepara horas gravadas, aceitas e conciliação; a interface financeira e de vídeo está fora desta versão.

## Dependências e execução local

Node.js 24 LTS e npm. O `package-lock.json` fixa as versões instaladas. Não use `npm audit fix --force` sem revisar mudanças.

```powershell
cd C:\Users\wdccr\praxis\operumdata-crm
npm ci
Copy-Item .env.example .env.local
# Edite .env.local com URL e chave pública do seu projeto Supabase.
npm run dev
```

Endereço local: `http://localhost:5173/operumdata-crm/`. As variáveis públicas são `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (chave publishable/anon do Supabase, nunca chave secreta). `VITE_BASE_PATH` é lida do ambiente de execução do Vite; o padrão é `/operumdata-crm/`. Nenhum cadastro público está disponível na interface.

## Configurar Supabase

1. Crie um projeto Supabase **dedicado ao CRM**, escolhendo região apropriada e guardando a senha do banco em um gerenciador seguro. Não reutilize bases de outros projetos.
2. No SQL Editor, execute, nesta ordem:
   - `supabase/migrations/202610290001_initial.sql`
   - `supabase/migrations/202610290002_hardening.sql`
   - `supabase/migrations/202610290003_returning_visibility.sql`
   - `supabase/migrations/202610290004_authorship.sql`
   - `supabase/migrations/202610290005_latest_evaluation.sql`
3. Alternativa usando CLI instalada: `supabase login`, `supabase link --project-ref SEU_PROJECT_REF`, `supabase db push`. Use o histórico de migrations; não reaplique manualmente uma migration já aplicada.
4. Em Authentication > Sign In / Providers, **desabilite Allow new users to sign up**. O arquivo `supabase/config.toml` documenta a configuração local; ele não substitui a verificação do painel hospedado.
5. Em Authentication > URL Configuration, defina Site URL como a URL final do frontend e adicione URLs de redirecionamento exatas, incluindo o caminho `/operumdata-crm/`. Para desenvolvimento, autorize também `http://localhost:5173/operumdata-crm/` e `http://127.0.0.1:5173/operumdata-crm/`.
6. Configure SMTP transacional no Supabase para entrega confiável dos convites e recuperação. Defina política de senha de pelo menos 12 caracteres e habilite as proteções de senha disponíveis no seu plano.
7. Copie a URL e a chave pública em `.env.local`. Nunca copie senha PostgreSQL, chave secreta ou `service_role` para uma variável `VITE_*`.
8. Não exponha o schema `private` na API. Mantenha RLS habilitada em todas as tabelas públicas. Não libere permissões amplas para resolver erros de acesso.

### Primeiro administrador

Crie o usuário em Authentication > Users > Add user (com senha forte ou convite). Copie o UUID gerado e execute no SQL Editor, substituindo o valor abaixo pelo UUID real; não use este exemplo como credencial:

```sql
insert into public.profiles(id,name,role,active)
values ('UUID_DO_USUARIO_AUTH'::uuid,'Administrador OperumData','admin',true);
```

O UUID é uma referência ao usuário real de `auth.users`. Sem perfil ativo, o login não concede acesso comercial. Não há promoção automática do primeiro visitante.

### Convites e desativação

Configure o secret de função `APP_URL` com a URL absoluta do frontend (inclusive `/operumdata-crm/`). O Supabase injeta `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no servidor. Publique com:

```text
supabase secrets set APP_URL=https://SEU_USUARIO.github.io/operumdata-crm/
supabase functions deploy manage-users
```

Em Configurações > Equipe, o administrador convida usuários e atribui perfil. A função valida o JWT com `getUser()`, consulta perfil ativo no banco e só então usa a API administrativa. Convites recebidos abrem o formulário para definir senha. A função mantém verificação JWT habilitada; valide-a com a configuração de chaves do seu projeto. Para recuperação, envie um recovery link pelo painel de Auth; a aplicação trata `PASSWORD_RECOVERY`.

Desative um usuário em Configurações > Equipe > Editar acesso. O RLS consulta `active` em cada operação; sessões existentes deixam de ler dados. O último administrador ativo não pode ser desativado. Não exclua usuários de Auth que ainda sejam referenciados por histórico.

## Segurança e regras de negócio

Administrador tem acesso completo; prospector trabalha nas oportunidades atribuídas; comercial somente nas oportunidades em que é responsável ou comercial autorizado. Somente administrador reatribui leads. Contatos de uma empresa são compartilhados somente entre usuários autorizados para essa empresa. Não distribua oportunidades da mesma empresa para prospectores que devam ser isolados entre si: eles compartilham o cadastro da empresa, enquanto as oportunidades e atividades continuam isoladas.

Contratos, avaliações, operação e respectivas entradas de auditoria não são visíveis para prospectores. Cadastro público desabilitado, perfil obrigatório e políticas server-side evitam confiar no frontend. Protocolos e avaliações são imutáveis; publique nova versão e registre nova avaliação. A autoria de atividades é a do usuário autenticado. Histórico e registros comerciais não podem ser apagados pelo cliente, inclusive pelo administrador via UI. Exclusão e anonimização seguem procedimento controlado abaixo.

- Perda e inelegibilidade exigem motivo. Reabertura é mudança de etapa, preservando auditoria.
- CNPJ é normalizado na interface e único no banco. Telefones e nomes geram aviso; sem CNPJ não se presume unicidade. Importação considera apenas duplicatas visíveis; o índice global bloqueia CNPJ de outra atribuição sem revelar seus dados.
- Elegibilidade separa compatibilidade comercial, critérios técnicos, demanda ativa e aprovação individual formal. O banco verifica critérios básicos contra participantes disponíveis e respostas. Exceções exigem referência de autorização. O avaliador continua responsável pela veracidade das evidências.
- Versão inicial usa mínimo configurável de cinco, sem tornar definitivo o requisito em discussão em 28/10/2026. Aprovação individual da Praxis é exigida antes da assinatura. Somente publique dispensa de aprovação com protocolo formalmente autorizado.
- Contrato exige data, confirmação explícita, referência e avaliação da versão vigente com aprovação necessária. A originação é imutável. Seus 12 meses são uma referência negociada.
- Operação exige contrato assinado. Ativação exige primeira gravação efetiva; implantação concluída não basta. Horas aceitas ficam separadas e não são estimadas.
- Não há automação de pagamentos, valores contestados ou prontidão de 90 dias.

## Uso diário

1. Entre com administrador. Clique Empresa, preencha cadastro e salve.
2. Clique Oportunidade, vincule empresa, campanha e responsáveis. Empresas sem oportunidade aparecem ao final de Leads.
3. Abra a ficha e cadastre contatos. Links de telefone e WhatsApp abrem aplicativos do dispositivo sem enviar mensagens automaticamente.
4. Registre ligação; resultado e decisor são campos independentes. Em Classificar / reabrir, registre o resultado da pré-qualificação. Encaminhamento ao comercial é feito pelo administrador atribuindo o responsável comercial.
5. Programe retorno com ação e data. A primeira tarefa pendente por prazo é exibida na ficha e na lista. Use filtro de próxima ação até hoje e sem contato há sete dias.
6. Reuniões: agende, confirme, reagende, registre ausência ou realização. A agenda interna é uma lista cronológica; o link Evento externo abre o formulário de criação no Google Calendar, sem OAuth.
7. Comercial registra avaliação com referências, formaliza contrato e confirma data real da assinatura. Depois classifique a etapa comercial como Contrato assinado. O indicador de assinatura usa o contrato, mesmo se a etapa ainda não foi atualizada.
8. Em Operação, registre bloqueios e implantação. Informe a primeira gravação somente quando confirmada.
9. Dashboard mostra registros reais autorizados. Não há números demonstrativos em produção. Datas filtram cada evento; filas atrasadas e próximas reuniões mostram a posição atual. Conversões consideram oportunidades da coorte com ambos os marcos no período, sem contar tentativas repetidas como novas empresas. A configuração de metas está nas campanhas.
10. Recarregue ou saia e entre novamente: os dados são consultados do PostgreSQL. Em outra conta prospector, somente as atribuições desse usuário devem aparecer.

## CSV

Leads > Importar CSV permite arquivo UTF-8 de até 2 MB e 2.000 linhas por lote, mapeamento de razão social, nome fantasia, CNPJ, telefone, cidade, UF e origem, prévia e relatório por linha. Linhas inválidas ou com possíveis duplicatas são ignoradas. Empresa e oportunidade são gravadas sequencialmente: se só a segunda gravação falhar, o relatório indica como criar a oportunidade para a empresa já preservada. Não reimporte todo o lote sem consultar o relatório.

Exportar CSV usa os registros visíveis após filtros e neutraliza células que poderiam ser executadas como fórmulas em planilhas. Não inclui contratos ou dados restritos. O arquivo exportado passa a exigir proteção e retenção adequadas fora do CRM. Integrações com Forms/Sheets podem usar o mesmo modelo, sempre com validação e atribuição no servidor.

## Testes e build

```text
npm test
npm run test:db
npx playwright install chromium
npm run test:ui
npm run build
npm audit
```

Testes de RLS cobrem acesso anônimo, isolamento de dois agentes, escalada de perfil, desativação, contrato, aprovação, motivo obrigatório, duplicatas, histórico e marcos de ativação. O banco de testes é sintético e separado. Testes de navegador usam interceptação HTTP, sem substituir os testes do banco e sem provar entrega SMTP ou integração Auth hospedada. Faça a homologação abaixo no Supabase antes de usar dados reais.

## GitHub e publicação

O repositório Git local deve permanecer independente. O conector GitHub disponível não fornece criação de repositórios, e `gh` não estava instalado no ambiente de entrega. Crie um **novo** repositório vazio `operumdata-crm` na conta desejada, preferencialmente privado se o plano permitir Pages. Não use repositórios de outros projetos.

```text
git remote add origin https://github.com/SEU_USUARIO/operumdata-crm.git
git push -u origin main
```

Em Settings > Pages escolha **GitHub Actions**. Em Settings > Secrets and variables > Actions > Variables, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com valores públicos do projeto dedicado. Não crie variável `service_role` no GitHub ou frontend. Execute o workflow. Ele valida testes, exige variáveis não vazias, compila com base `/operumdata-crm/` e publica somente `dist/` em `main`. PRs executam validação, sem publicação. Para domínio próprio ou nome diferente, altere `VITE_BASE_PATH` no workflow e as URLs autorizadas do Supabase.

A URL real é a fornecida pela execução do job deploy. Esta entrega não presume URL publicada. Assets são públicos em Pages; dados exigem autenticação e RLS.

## Backup e restauração

Ative backups automáticos e, se disponível no plano, recuperação pontual no Supabase. Defina responsável, frequência e prazo de retenção segundo necessidade da OperumData. Teste restauração em projeto isolado antes de considerar o backup validado.

Para backup adicional usando CLI autenticada, grave **fora do repositório**, em volume protegido:

```text
supabase db dump --linked --file CAMINHO_SEGURO/schema.sql
supabase db dump --linked --data-only --use-copy --file CAMINHO_SEGURO/data.sql
supabase db dump --linked --role-only --file CAMINHO_SEGURO/roles.sql
```

Esses dumps não substituem uma estratégia de recuperação completa de Auth. Consulte o procedimento de backup do Supabase para usuários Auth, configurações e secrets. Não publique dumps, exports, credenciais ou arquivos `.env`. Restaure primeiro em banco vazio isolado, valide contagens, vínculos, perfis/RLS e login, e só então planeje troca de ambiente.

## LGPD, retenção e exclusão

Colete contatos corporativos e referências mínimas. Não anexe vídeos, documentos pessoais ou imagens de participantes. Controle as permissões das referências em seu provedor de documentos. Defina base legal, aviso de privacidade, canal de atendimento e retenção com o responsável da OperumData.

Para pedidos de exclusão ou término da retenção, administrador autorizado identifica empresa e dependências no painel/SQL Editor, exporta somente evidência estritamente necessária para local seguro, e anonimiza nome, telefone, e-mail, localização e textos livres no PostgreSQL. A auditoria contém snapshots e precisa ser incluída na anonimização; não basta limpar `contacts`. Execute em transação revisada, registre solicitação e responsável fora dos dados anonimizados, e respeite retenção legal e cópias de backup. Esse procedimento é deliberadamente administrativo: não há DELETE indiscriminado no navegador. Antes de expurgar Auth, remova/anonimize referências preservando integridade ou apenas desative a conta.

## Homologação necessária após conectar os serviços

- Entrar como administrador real; cadastrar empresa fictícia identificada como teste, decisor, ligação, tarefa e reunião; recarregar e encerrar/reabrir sessão.
- Atribuir leads distintos a dois prospectores e testar leitura e tentativa de escrita cruzada pela API do projeto real, além da UI.
- Registrar elegibilidade, referência formal da aprovação, assinatura e primeira gravação; conferir indicadores separados.
- Enviar convite e recuperação por SMTP, definir senha, desativar usuário com sessão aberta e confirmar bloqueio.
- Executar workflow e verificar assets no caminho-base, política de origem da função e redirecionamentos de Auth.
- Validar backup/restauração e política de retenção antes de importar base real.

Limites do MVP: listagem carrega registros autorizados em lotes e pagina visualmente 25 por página; para bases grandes, migrar filtros/agregações para consultas SQL/RPC server-side antes de ampliar a operação. Agenda é cronológica, sem grade mensal. Relatórios são operacionais, sem ERP. Critérios adicionais em JSON são referências; novos critérios automáticos exigem migração e novos testes. Essas limitações não criam dados fictícios ou permissões extras.

Documentação oficial consultada: [RLS no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [gerenciamento de usuários](https://supabase.com/docs/guides/auth/managing-user-data), [convites administrativos](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) e [Vite](https://vite.dev/guide/).
