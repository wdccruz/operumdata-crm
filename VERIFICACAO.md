# Verificação da entrega

Projeto: `operumdata-crm`, Git independente em `main`. Nenhum outro repositório foi alterado. Não há conexão configurada com um projeto Supabase de produção, nem frontend publicado nesta entrega.

## Resultados executados

- `npm install` e atualizações pontuais: dependências instaladas e lockfile gerado.
- `npm test`: **7 testes de domínio passaram**.
- `npm run test:db`: **34 testes PostgreSQL/RLS passaram**, executando as cinco migrations em PGlite. Inclui persistência por exportação/restauração do diretório do banco, autorização de agentes, desativação com sessão existente, autoria, auditoria, duplicatas, reabertura, aprovação vigente, assinatura e ativação.
- `npx playwright install chromium`: Chromium de testes instalado.
- `npm run test:ui`: **2 cenários passaram**, desktop Chromium e viewport de iPhone 13 usando Chromium. Testes usam **API HTTP simulada** com dados sintéticos, não Supabase hospedado. Exercitam login de interface, empresa, oportunidade, contato, ligação, tarefa, reunião, avaliação, contrato e reload; também verificam ausência de overflow horizontal. Não equivalem a validação no Safari real.
- `npm run build`: build TypeScript/Vite de produção aprovado, com base `/operumdata-crm/`.
- `npm audit`: nenhuma vulnerabilidade detectada na árvore instalada na verificação final.
- Inspeção visual dos screenshots de dashboard desktop e ficha mobile, gerados pelos testes. Artefatos temporários em `test-results/`, ignorados pelo Git.
- `git init -b main`: repositório local separado inicializado.

Problemas encontrados durante execução foram corrigidos: dependência de testes vulnerável, semântica SQL de NULL em campos condicionais, visibilidade RLS em INSERT RETURNING, nomes acessíveis de campos e referência à avaliação vigente mais recente. As falhas iniciais não são apresentadas como resultados finais.

## Pendências externas

1. Criar projeto Supabase dedicado, aplicar **todas as cinco migrations** e desabilitar cadastro público no Auth hospedado.
2. Criar o primeiro usuário administrador real e seu perfil; definir URL/chave pública nas variáveis de ambiente.
3. Configurar SMTP, URLs autorizadas e secret `APP_URL`; publicar a função `manage-users` e homologar convite/recuperação reais.
4. Criar repositório remoto novo `operumdata-crm`, adicionar remote e enviar `main`. O GitHub conectado identifica `wdccruz`, mas o conector não oferece criação de repositórios; não havia `gh` instalado. Nenhuma credencial GitHub foi extraída ou gravada.
5. Ativar Pages por Actions, cadastrar as duas variáveis públicas no repositório e executar o workflow. Não há URL publicada a declarar.
6. Homologar com duas contas prospectores no Supabase real, validar backup/restauração e retenção antes de importar dados comerciais.

## Escopo e limites declarados

Agenda interna em lista cronológica, não grade mensal. CSV suporta campos essenciais de prospecção, prévia, mapeamento e relatório, sem importação de contratos ou documentos. Leads listados com 25 por página; dados autorizados são buscados em lotes para o volume inicial, com agregação no cliente. Horas gravadas/aceitas têm tabela preparada; sem gestão de vídeo, cobrança ou ERP. Exclusão/anonimização é procedimento administrativo documentado, incluindo snapshots da auditoria. Critérios extras em JSON são referências; novas regras automáticas exigem migração/testes.

O código entrega a base funcional para os 11 critérios de aceite. Login real, persistência pelo serviço hospedado e publicação só podem ser confirmados depois da configuração externa. Instruções detalhadas e comandos estão no README.
