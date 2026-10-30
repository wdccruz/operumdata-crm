# OperumData CRM

CRM comercial da OperumData para prospecção e acompanhamento de parceiros. Primeiro comprador configurado: Praxis Robotics. Código e infraestrutura são independentes de outros projetos. **Dados comerciais ficam no PostgreSQL do Supabase; GitHub recebe somente código.**

## Estado da entrega

Página pública para compartilhar: **https://wdccruz.github.io/operumdata-crm/**. O código está público por autorização do proprietário. O CRM mantém Supabase Auth e RLS; abrir o link não concede acesso aos dados. A instalação privada anterior em **https://operumdata-crm.blondseed19.chatgpt.site/** permanece disponível. O projeto Supabase existente `operumdata-crm`, organização OperumData, região Ohio, está conectado. As seis migrations estão aplicadas; as 16 tabelas públicas têm RLS, com 42 políticas. Cadastro público e login anônimo estão desabilitados. O proprietário definiu sua senha e teve a sessão administrativa confirmada.

Foram aprovadas 13 validações no serviço hospedado, incluindo login, persistência após nova sessão, CRUD, isolamento de agentes, função administrativa e acesso à interface publicada. As contas e registros operacionais sintéticos foram removidos. Os testes offline continuam separados: domínio, PostgreSQL embarcado e navegador com API simulada. Chaves administrativas não fazem parte do frontend ou do repositório.

## Versão 1.1 — estabelecimentos, idiomas e acesso Praxis

**Estabelecimentos é o cadastro central da rede.** Toda empresa salva em "+ Empresa" (ou importada por CSV) aparece imediatamente em Estabelecimentos, com ou sem oportunidade, contrato, implantação ou gravação. Oportunidade (processo comercial), contrato (formalização) e ativação (início real da gravação) continuam sendo registros vinculados, não condições de exibição.

- **Status comercial** (`companies.commercial_status`): Cadastrada (inicial), Potencial, Em prospecção, Em qualificação, Em negociação, Aguardando Praxis, Em estoque, Contratada, Descartada. Descartada exige motivo. Contratada exige contrato com assinatura efetiva já registrada. Alterar status nunca cria oportunidade ou contrato.
- **Status operacional** (`companies.operational_status`), independente: Não iniciada, Aguardando implantação, Em implantação, Gravando, Pausada, Encerrada. Gravando exige confirmação explícita e data de início efetivo; contrato assinado ou implantação concluída não bastam. Restrito a administrador e comercial.
- **Importância estratégica** (`strategic_importance`): Alta, Média, Baixa, Não avaliada, com justificativa. Editável somente pelo administrador. Não é calculada automaticamente e não se confunde com prioridade setorial.
- **Histórico** (`company_status_history`): toda mudança de status ou importância registra valor anterior, novo, motivo, data e responsável, gravados por trigger no servidor. A auditoria completa (`audit_log`) continua ativa.
- **Listagem**: tabela com filtros rápidos (Todas, Potenciais, Em prospecção, Em estoque, Contratadas, Gravando, Pausadas, Descartadas), filtros por cidade, estado, setor, importância, responsável e faixa de participantes, e pesquisa por nome, CNPJ e telefone. A ficha reúne dados cadastrais, perfil operacional, classificação, relacionamento (oportunidades, contratos, ações, reuniões, ligações) e histórico.
- Os bancos guardam **códigos estáveis** (`registered`, `stock`, `recording`...). As etapas e resultados anteriores continuam com seus valores originais no banco; a tradução é apenas de exibição.
- A migration preenche somente fatos já registrados: empresa com contrato assinado vira Contratada; empresa com operação em "Gravações em andamento" e primeira gravação vira Gravando. Nenhum dado é apagado.

**Idiomas.** Português (pt-BR, padrão) e inglês (en-US) com `react-i18next`. As chaves são os próprios textos em português (`src/locales/en-US.ts` traduz). O seletor PT/EN fica no cabeçalho e na tela de entrada; a preferência é salva por usuário em `profiles.locale` pela função `public.set_my_locale`. Textos livres digitados pelos operadores não são traduzidos. `tests/i18n.test.ts` falha se algum texto de interface ficar sem tradução.

**Perfil `praxis_viewer`.** Leitura integral de todos os módulos (dashboard, empresas, leads, oportunidades, prospecção, agenda, contratos, avaliações, operação, histórico, auditoria e relatórios), no mesmo CRM, com as funções de edição ocultas. O bloqueio é feito no banco: políticas RLS `RESTRICTIVE` exigem perfil de escrita (`admin`, `prospector`, `commercial`) para qualquer INSERT/UPDATE/DELETE em todas as tabelas públicas, inclusive por chamada direta à API. Configurações e gestão de usuários não aparecem para esse perfil. Nenhum segredo de Auth, hash de senha ou chave administrativa é acessível pelo cliente.

### Aplicar a V1.1 no Supabase

1. Aplique `supabase/migrations/202610290007_establishments_v11.sql` (SQL Editor ou `supabase db push`). Enquanto ela não estiver aplicada, o frontend continua funcionando com o modelo anterior e mostra um aviso ao administrador.
2. (Opcional, para convites pela interface) publique a função atualizada: `supabase functions deploy manage-users`. Para usar o convite a partir do GitHub Pages, defina `APP_URL=https://wdccruz.github.io/operumdata-crm/` e, se quiser manter a instalação anterior, `ALLOWED_ORIGINS=https://operumdata-crm.blondseed19.chatgpt.site/`.
3. Em Authentication > URL Configuration, inclua `https://wdccruz.github.io/operumdata-crm/` nas Redirect URLs (e como Site URL, se o Pages for o endereço principal), para que links de convite e recuperação abram o CRM publicado.

### Registro de acessos

Configurações > **Registro de acessos** (somente administrador) mostra, por usuário:
- último login (Supabase Auth);
- último acesso ao CRM;
- quantidade de acessos em 30 dias;
- os 50 acessos mais recentes, com navegador e sistema.

Cada abertura do CRM com sessão válida grava um acesso pela função `public.record_access`, no máximo um a cada 30 minutos por usuário. Ninguém consegue gravar, alterar ou apagar registros diretamente nem registrar acesso em nome de outro usuário. A consulta usa `public.access_overview`, que recusa quem não é administrador. Exige a migration `202610300009_access_log.sql`; antes dela, a seção mostra um aviso e o restante do CRM funciona normalmente. Abrir o link sem fazer login não gera registro, e o GitHub Pages não fornece log de visitas.

### Criar um usuário de leitura da Praxis

1. Authentication > Users > **Invite user** com o e-mail corporativo do usuário. Não use senha fixa ou previsível; o convidado define a própria senha (mínimo 12 caracteres) ao abrir o link.
2. No SQL Editor, vincule o perfil de leitura e o idioma inglês (substitua o e-mail):

```sql
insert into public.profiles(id,name,role,active,locale)
select id,'NOME DO USUÁRIO','praxis_viewer',true,'en-US' from auth.users where email='EMAIL_DO_USUARIO'
on conflict (id) do update set role='praxis_viewer',active=true,locale='en-US';
```

Alternativa: Configurações > Equipe > Convidar usuário, perfil "Praxis · somente leitura" (requer a função publicada no passo 2 acima).

## Arquitetura

- React 19 + TypeScript, Vite, Tailwind 4 e CSS institucional. Ícones Lucide, CSV com PapaParse.
- `src/db.ts`: Supabase Auth, leitura paginada e gravação no PostgREST. Sessão em `sessionStorage`, sem banco no navegador. Encerrar a sessão ou fechar o navegador não exclui registros no servidor.
- `src/domain.ts`: indicadores, CNPJ, duplicatas, faixa de participantes e eventos externos.
- `src/CsvImport.tsx`: importação com prévia, mapeamento e relatório.
- `src/Editor.tsx`: formulários reutilizáveis com validação, mensagens e bloqueio durante salvamento.
- `src/App.tsx`: navegação, ficha por abas e módulos comerciais. `src/Establishments.tsx`: listagem e ficha de estabelecimentos. `src/i18n.ts` e `src/locales/en-US.ts`: idiomas. `src/style.css`: tema e responsividade.
- `supabase/migrations`: esquema normalizado, índices, privilégios, RLS, auditoria e triggers de integridade. Aplique todos os arquivos na ordem do nome.
- `supabase/functions/manage-users`: convite administrativo. A chave `service_role` existe exclusivamente no servidor.
- `scripts/test-db.mjs`: integração PostgreSQL/RLS com contas sintéticas.
- `scripts/test-hosted.mjs`: homologação explícita contra Supabase real; credencial de servidor apenas em runtime local restrito, nunca em CI ou no frontend.
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
   - `supabase/migrations/202610290006_server_privileges.sql`
   - `supabase/migrations/202610290007_establishments_v11.sql`
   - `supabase/migrations/202610290008_access_activations.sql`
   - `supabase/migrations/202610300009_access_log.sql`
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

Administrador tem acesso completo; `praxis_viewer` lê tudo e não grava nada; prospector trabalha nas oportunidades atribuídas; comercial somente nas oportunidades em que é responsável ou comercial autorizado. Somente administrador reatribui leads. Contatos de uma empresa são compartilhados somente entre usuários autorizados para essa empresa. Não distribua oportunidades da mesma empresa para prospectores que devam ser isolados entre si: eles compartilham o cadastro da empresa, enquanto as oportunidades e atividades continuam isoladas.

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

Testes de RLS cobrem acesso anônimo, isolamento de dois agentes, escalada de perfil, desativação, contrato, aprovação, motivo obrigatório, duplicatas, histórico e marcos de ativação. Os dois cenários de Playwright usam API simulada. A validação adicional de `scripts/test-hosted.mjs` foi executada no Supabase real e na URL publicada, com contas sintéticas descartáveis e acesso técnico da hospedagem restrito à própria origem. O relatório local fica em `artifacts/homologacao/`, ignorado pelo Git.

O teste hospedado não roda automaticamente em CI. Ele lê uma chave de servidor de uso único em `%USERPROFILE%/.codex/tmp/operumdata-crm-runtime/server-key.once`, remove o arquivo imediatamente, gera senhas sintéticas em memória e limpa seus registros no final. Prepare essa credencial por canal administrativo local protegido, sem argumentos de shell ou logs. Defina `CRM_PUBLIC_URL` para o endereço testado. O teste da hospedagem privada recebe seu acesso técnico por stdin sem eco (`CRM_SITES_TEST=1`), enviando-o apenas à origem do Site, nunca ao Supabase. Não use esse mecanismo para acesso cotidiano de usuários.

## GitHub e publicação

O código está no repositório **público** [wdccruz/operumdata-crm](https://github.com/wdccruz/operumdata-crm), por autorização explícita do proprietário. O histórico foi verificado antes da mudança de visibilidade. Dados comerciais, arquivos `.env.local`, senhas e chaves administrativas não foram publicados.

**Página para compartilhar:** https://wdccruz.github.io/operumdata-crm/

O GitHub Pages está habilitado por Actions, com `ENABLE_PAGES=true`. A publicação passou por testes, build e deploy. O HTML e os cinco assets JS/CSS responderam HTTP 200. O caminho-base é `/operumdata-crm/`. As variáveis de build contêm somente a URL e a chave pública do Supabase.

```text
git push origin main
```

Pushes em `main` executam validação e atualizam Pages automaticamente. Pull requests executam validação sem publicação. Qualquer pessoa pode abrir a tela de entrada; o acesso ao dashboard e aos leads exige usuário ativo e as permissões RLS. O cadastro público continua desabilitado. Publicar o código não torna o banco público.

A instalação Sites anterior continua privada: https://operumdata-crm.blondseed19.chatgpt.site/. A configuração canônica de convites, recuperação e CORS da função administrativa ainda aponta para essa instalação. Nesta publicação de visualização não foram alteradas configurações do Supabase pelo navegador, cuja conexão estava indisponível. Login direto por e-mail/senha usa o mesmo projeto Supabase; para administrar convites, use a instalação privada até atualizar as origens permitidas e os callbacks para Pages.

O checkout da instalação privada é `../operumdata-crm-hosting`, Site `appgprj_6ae3a65dd0d88191a856955196597deb`. Não é atualizado automaticamente pelo push ao GitHub. O endereço local continua `http://127.0.0.1:5173/operumdata-crm/` enquanto o servidor estiver ativo.

Antes de convidar prospectores externos, configure SMTP próprio no Supabase. O serviço padrão limita destinatários e volume. O piloto continua com autenticação e acesso mínimo aos dados.

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

## Links manuais de ativação

O endpoint `activate-access` recebe um segredo aleatório de 256 bits, vinculado a um usuário `praxis_viewer` ativo. A migration 0008 armazena somente o hash em `access_activations`, sem data de expiração. A tabela e as três RPCs são acessíveis somente por `service_role`, nunca por anon/authenticated. A função valida o segredo antes de emitir qualquer sessão. `verify_jwt=false` vale somente para esse endpoint, pois o destinatário ainda não possui sessão; a autorização é feita pelo segredo de uso único. As demais funções e as políticas de dados continuam protegidas.

O link usa `#activation=...`: o fragmento não é enviado ao servidor da página nem aos robôs de prévia. Abrir a página não consome o link. O destinatário precisa clicar em Ativar e definir senha. Só após validação, emissão da sessão e marcação atômica de uso o formulário de senha abre. A reserva de concorrência pode ser retomada após falha; não representa vencimento do link. Links usados ou revogados são rejeitados. Nenhum e-mail é disparado por essa função. As sessões Supabase continuam com seu prazo normal depois da ativação.

Para revogar um link, administrador autorizado executa no SQL Editor `update public.access_activations set revoked_at=now() where id='UUID_DO_REGISTRO';`. Desativar o perfil também impede a ativação. Não registrar o segredo em logs, código, relatório ou banco; enviá-lo somente ao destinatário autorizado.
