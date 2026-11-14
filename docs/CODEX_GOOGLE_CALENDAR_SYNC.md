# Especificação para Codex — Sincronização do CRM OperumData com Google Agenda

Data: 14/11/2026  
Repositório: `wdccruz/operumdata-crm`  
Projeto Supabase correto: `operumdata-crm` (`lpmzgbsvswnlxomaoyzj`). Não confundir com `operumdata-comercial`, projeto separado que foi pausado por inatividade.

## Objetivo do usuário
O usuário quer registrar **uma única vez** follow-ups (tarefas de retorno) e reuniões no CRM, e vê-los automaticamente em seu **Google Agenda**, com avisos no celular. Não quer abrir o Google Agenda e digitar compromissos novamente. Quer também, ao abrir o CRM pela manhã, saber quais retornos estão vencidos, quais são de hoje e quais reuniões tem agendadas.

**Entregar funcionamento real**, não somente link para criar evento. Não afirmar que a integração está ativa antes de autenticação Google, deploy e testes.

## Constatações do repositório
- `src/App.tsx` já tem `tasks`, `meetings`, formulário de `Próxima ação / retorno`, formulário de reunião, dashboard com "Ações que precisam avançar" e área "Agenda".
- `src/domain.ts` oferece `googleEvent(...)`, que **apenas monta uma URL** para o formulário do Google Agenda; não salva nem sincroniza automaticamente.
- O README documenta que o link "Evento externo" só abre a criação manual no Google Agenda, **sem OAuth**.
- O CRM usa React/Vite e Supabase Auth + PostgreSQL/RLS. Os dados reais ficam no Supabase e não devem ser copiados para GitHub.
- A consulta técnica ao Supabase retornou falha de autenticação do usuário de leitura `supabase_read_only_user` (28P01), apesar de o projeto CRM aparecer como ativo. Isso pode impedir inspeção e validação hospedada. É uma ocorrência separada de OAuth Google; ver issue #1.

## Entrega funcional — fase 1 (prioridade)
1. **Conectar conta Google** dentro das configurações do CRM: mostrar "Conectar Google Agenda", estado conectado/desconectado, conta escolhida e possibilidade de desconectar. Usar OAuth 2.0 oficial, consentimento explícito e escopos mínimos necessários. O calendário pessoal principal é o padrão proposto, mas permitir escolher entre calendários com permissão de escrita.
2. **CRM → Google Agenda, automático**: ao cadastrar reunião em `meetings` ou retorno com data/hora em `tasks`, criar evento no calendário escolhido sem outra digitação. Ao reagendar/editar, atualizar o **mesmo** evento. Ao concluir um retorno, marcar o correspondente evento como concluído/remover ou cancelar segundo regra explícita de produto; ao cancelar uma reunião, cancelar ou remover somente o evento criado pela integração. Preservar dados históricos e auditoria no CRM.
3. **Eventos do CRM identificáveis**: títulos como "OperumData — Reunião — [Empresa]" e "OperumData — Follow-up — [Empresa]"; incluir tarefa, data, contato comercial e referência interna segura na descrição, evitando CNPJ, telefone e outros dados pessoais se não forem necessários. Não enviar convites ao empresário automaticamente.
4. **Lembretes** no Google Agenda: sugerir reunião 15 min antes e retorno 10 min antes, configuráveis por usuário. Horários sempre no fuso `America/Sao_Paulo`, sem erro de conversão UTC/horário de verão.
5. **Painel "Minha agenda de hoje"** no dashboard do CRM: follow-ups vencidos; follow-ups de hoje; reuniões de hoje; próximos compromissos. Exibir contagem, horário, empresa, responsável, status e atalho para a ficha e para concluir/reagendar. Filtrar conforme permissões do usuário; não mostrar dados de agentes não autorizados.
6. **Sem duplicidade**: persistir vínculo estável `CRM task/meeting ID ↔ Google Calendar event ID + calendar ID + owner`; criação idempotente e atualizações incrementais com retry/backoff; evitar um evento novo a cada edição/refresh; lidar com evento removido pelo usuário no Google de forma previsível, sem recriação infinita.
7. **Reconciliação**: sincronizar alterações feitas com rede intermitente, falhas temporárias, token expirado; indicar "sincronização pendente/falhou" no CRM sem impedir o registro comercial.
8. **Ativação seletiva**: quando usuário conectar seu Google Agenda, oferecer sincronização de compromissos futuros existentes, com prévia/confirmacão e política antiduplicação. Não importar ou alterar automaticamente compromissos pessoais não criados pelo CRM.

## Escopo de sincronização e limites da fase 1
- **Fonte de verdade** das tarefas comerciais e reuniões criadas no CRM é o próprio CRM. O Google Agenda recebe uma cópia sincronizada.
- Calendário → CRM, conflitos bidirecionais, leitura de compromissos pessoais para disponibilidade, criação automática de reuniões Google Meet e convite de participantes são evoluções possíveis de **fase 2**, não requisitos para o primeiro release.
- O sistema não consegue inferir compromissos de ligações ou conversas sozinho. Uma tarefa/reunião precisa ser registrada no CRM uma vez; a cópia para o calendário é automática.
- Cada usuário precisa autorizar seu próprio Google. A conexão Google Calendar existente no ChatGPT **não** autoriza a aplicação CRM.

## Arquitetura e segurança (requisitos obrigatórios)
- Usar Google Calendar API oficial e OAuth com fluxo apropriado ao SPA + backend seguro; `client_secret`, refresh token e chaves administrativas **jamais no navegador, Vite `VITE_*`, GitHub, issue, logs ou URL**.
- Guardar tokens de forma protegida/encriptada no backend; chamadas à API Google e refresh do token do lado servidor (por exemplo Supabase Edge Functions/worker com autenticação e autorização).
- Associar conta Google, calendar ID, event ID e estado da sincronização ao usuário CRM autorizado. Respeitar RLS/roles, segregação de prospectores e auditoria.
- Solicitar apenas permissões necessárias, sem acesso ao Gmail ou Drive. O usuário deve poder revogar acesso/desconectar e interromper futuras sincronizações, sem apagar seus dados comerciais.
- Novas tabelas, políticas ou funções precisam de migration versionada, revisão de segurança, testes RLS; aplicar em homologação primeiro.
- Não trocar credenciais existentes, não reduzir RLS, não expor `service_role`, não migrar dados entre projetos Supabase.
- Conexão depende de configurar projeto Google Cloud, tela de consentimento, credenciais OAuth, URIs de redirecionamento para o endereço implantado, APIs e eventual verificação. Registrar as etapas humanas necessárias em documentação.

## Fluxos de aceitação
1. Usuário autorizado conecta o Google Agenda e vê qual calendário foi associado.
2. Cadastra retorno para empresa A amanhã às 10h: evento único aparece no Google Agenda e no painel CRM.
3. Reagenda para 11h: evento Google existente muda para 11h, sem duplicação.
4. Conclui o retorno: CRM deixa de exibi-lo como pendente e Google reflete a regra escolhida.
5. Agenda reunião virtual para empresa B: aparece como reunião no Google Agenda; depois cancela e vê o cancelamento sincronizado.
6. Após refresh, novo login e reconexão, vínculos persistem; sem duplicatas.
7. Falha/expiração de token: CRM salva a tarefa, sinaliza pendência, retoma ao reconectar sem duplicar.
8. Um usuário não consegue ver nem editar compromissos privados de outro; convidado `praxis_viewer` continua somente leitura.
9. O painel conta corretamente hoje/vencidos e lida com fuso de São Paulo e fronteira da meia-noite.
10. Nenhum cliente recebe convite ou notificação por e-mail sem ação expressa de convidar.

## Sequência de trabalho para Codex
1. Mapear schema/migrations, permissões existentes e componentes do CRM, avaliar estado da conexão Supabase (issue #1).
2. Propor arquitetura mínima com escolhas explícitas (one-way CRM→Google); documentar trade-offs, configurações e migrações.
3. Implementar numa **branch de desenvolvimento** com tests unitários/integrados de mapeamento, idempotência, RLS, falhas, fusos e cancelamento.
4. Criar PR para revisão; apresentar checklist de Google Cloud/OAuth, secrets e deploy.
5. Testar em homologação com conta/calendário de testes e eventos sintéticos; **não publicar em produção, não migrar dados reais e não fazer convites reais sem aprovação explícita**.

## Não confundir com automação pontual
O conector Google Agenda do ChatGPT pode criar eventos individuais quando solicitado, mas isso **não é** uma sincronização persistente entre o CRM e o Google. O objetivo é uma integração própria do CRM que funcione sem esta conversa aberta.
