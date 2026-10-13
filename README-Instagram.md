# 📸 Guia de Integração e Operação 100% Instagram Direct - ItecChatbot

Este documento contém o registro completo de tudo o que foi implementado, configurado e arquitetado para que a integração com o **Instagram Direct** funcione com **100% de estabilidade** no **ItecChatbot**.

---

## 📑 Sumário
1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Configurações Obrigatórias na Meta & Instagram](#2-configurações-obrigatórias-na-meta--instagram)
3. [Implementação no Backend (Node.js & Express)](#3-implementação-no-backend-nodejs--express)
4. [Ciclo de Vida do Atendimento & Reabertura de Fila](#4-ciclo-de-vida-do-atendimento--reabertura-de-fila)
5. [Interface do Usuário (Frontend SPA / React)](#5-interface-do-usuário-frontend-spa--react)
6. [Deploy e Execução em Produção (VPS)](#6-deploy-e-execução-em-produção-vps)
7. [Tabela de Resolução de Problemas (Troubleshooting)](#7-tabela-de-resolução-de-problemas-troubleshooting)

---

## 1. Visão Geral da Arquitetura

O **ItecChatbot** opera de forma **Omnichannel Unificada**. Mensagens de WhatsApp, Telegram e Instagram Direct são unificadas na mesma fila de atendimento humano do **LiveChat**, suportando transbordo, URA com múltiplos menus, inteligência artificial (OpenAI) e histórico centralizado.

### Fluxo de Mensagens Ponta a Ponta:

```
[ Cliente no Instagram App ]
           │
           ▼
[ Meta Graph API / Webhook ]
           │  (POST /api/webhooks/instagram)
           ▼
[ ItecChatbot Backend (Express) ] ── (Retorna 200 "EVENT_RECEIVED" em < 1s)
           │
           ├─► Consulta Graph API (/v20.0/{sender_id}) para capturar Nome, @username e Foto de Perfil
           ├─► Baixa áudios, imagens, vídeos e figurinhas para /uploads/ig_xxx.ext
           ├─► Salva/Atualiza Contato na tabela `contacts` (@instagram)
           ├─► Cria ou Reabre Atendimento na tabela `chats` (Gera protocolo, status: 'waiting')
           ├─► Grava no Histórico unificado `messages`
           │
           ▼
[ Socket.IO Realtime ] ──► [ Painel LiveChat (Navegador) ]
                                      │
                                      ▼
                        Atendente responde via painel
                                      │
                                      ▼
   [ POST https://graph.facebook.com/v20.0/me/messages ] ──► [ Direct do Cliente ]
```

---

## 2. Configurações Obrigatórias na Meta & Instagram

Para a Meta autorizar e despachar mensagens externas, os seguintes requisitos precisam estar cumpridos:

### 2.1. Requisitos da Conta do Instagram
1. **Conta Profissional:** A conta do Instagram precisa ser do tipo **Comercial (Business)** ou **Criador de Conteúdo (Creator)**.
2. **Página do Facebook Vinculada:** A conta do Instagram deve estar conectada a uma Página do Facebook (*Configurações da Página do Facebook ➔ Contas Vinculadas ➔ Instagram*).
3. **Liberar Acesso às Mensagens no App (Passo Crítico):**
   - No celular, no app do Instagram da conta conectada:
   - Abra o menu de **Configurações e privacidade**.
   - Acesse **Mensagens e respostas a stories** ➔ **Ferramentas para mensagens**.
   - Ative a chave: **"Permitir acesso às mensagens"**.  
   *(Se esta opção estiver desligada, a Meta bloqueia sumariamente a entrega de eventos aos servidores externos).*

---

### 2.2. Aplicativo no Meta for Developers
1. Acesse [developers.facebook.com](https://developers.facebook.com) e selecione o seu aplicativo.
2. **Permissões Essenciais do Token (Scopes):**
   - `instagram_basic`
   - `instagram_manage_messages`
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_metadata`
3. **Modo de Desenvolvimento:**
   - Enquanto o app estiver em modo *Desenvolvimento*, adicione o Instagram do cliente/testador em **Funções do Aplicativo ➔ Funções ➔ Testadores do Instagram**. Após aprovação comercial da Meta, o app pode ser colocado em modo *Produção*.
4. **Credenciais Necessárias:**
   - **ID da Página (`instagramPageId`):** Número de identificação da Página do Facebook vinculada ao Instagram (ex: `1381058191755817`).
   - **Token de Acesso da Página (`instagramAccessToken`):** Page Access Token de longa duração obtido via Graph API Explorer ou painel de tokens da Meta.

---

### 2.3. Configuração do Webhook da Meta
No painel do aplicativo da Meta (*Produtos ➔ Webhooks ➔ Instagram*):
- **URL de Retorno (Callback URL):**
  ```text
  https://itecchatbot.com.br/api/webhooks/instagram
  ```
- **Token de Verificação (Verify Token):**
  ```text
  itecchatbot_verify_token
  ```
- **Campos de Subscrição:** Assine os eventos:
  - `messages` (Obrigatório para receber texto e mídias)
  - `messaging_postbacks` (Obrigatório para botões e opções)
  - `message_deliveries` (Confirmação de entrega)
  - `message_reads` (Confirmação de leitura)

---

### 2.4. Inscrição da Página no Aplicativo (`subscribed_apps`)
Apenas preencher a URL de Webhook no painel da Meta **não ativa** o recebimento de mensagens para páginas específicas. É indispensável chamar:
```http
POST https://graph.facebook.com/v20.0/{PAGE_ID}/subscribed_apps
Params:
  subscribed_fields = messages,messaging_postbacks,message_deliveries,message_reads
  access_token = {PAGE_ACCESS_TOKEN}
```
> **Nota de Automação:** No **ItecChatbot**, essa inscrição é executada **automaticamente** pelo sistema sempre que a conexão do Instagram é iniciada ou reiniciada!

---

## 3. Implementação no Backend (Node.js & Express)

### 3.1. Isenção de Autenticação para Webhooks Públicos
* **Arquivo:** `src/app.js`
* As rotas de webhook da Meta foram posicionadas **antes** dos middlewares de autenticação JWT (`authenticateRequest`) e dos limitadores de taxa restritivos (`rateLimitMiddleware`), garantindo que os servidores da Meta não recebam `401 Unauthorized` nem `429 Too Many Requests`.

```javascript
// src/app.js
app.use('/api', healthRoutes);
app.use('/api/webhooks', webhookRoutes); // Rota pública para Meta, Instagram e Telegram
```

---

### 3.2. Roteador de Webhook
* **Arquivo:** `src/routes/webhookRoutes.js`
* Gerencia o handshake com a Meta e recebe os payloads de mensagens:

1. **Validação do Handshake (GET):**
   - Compara `hub.verify_token` com o token configurado (`itecchatbot_verify_token`).
   - Responde com `hub.challenge` com status `200 OK`.
2. **Recepção de Mensagens (POST):**
   - Retorna status `200 OK` com `'EVENT_RECEIVED'` de imediato (evitando timeout de 20s na fila da Meta).
   - Identifica o bot responsável pelo `entry.id` (Page ID) via `BotManagerService.getBotByInstagramPageId(pageId)`.
   - Encaminha o evento para o método assíncrono `handleWebhookEvent(entry)`.

---

### 3.3. Serviço do Instagram Direct
* **Arquivo:** `src/services/InstagramService.js`

Principais recursos implementados:

1. **Validação e Auto-Inscrição:**
   - Ao iniciar, consulta `GET /v20.0/{pageId}` para validar o token.
   - Em seguida, dispara `POST /v20.0/{pageId}/subscribed_apps` inscrevendo o app nos eventos de mensagens.
2. **Captura Completa de Perfil do Cliente:**
   - Executa `getUserProfile(senderId)` via `GET /v20.0/{senderId}?fields=name,username,profile_pic`.
   - O contato é salvo no banco de dados com:
     - **Nome:** `Nome Real (@username)`
     - **Foto de Perfil:** URL oficial da foto do Instagram
     - **Canal:** `'instagram'`
3. **Download e Armazenamento de Mídias:**
   - O método `processAttachments()` identifica o tipo de anexo (`image`, `audio`, `video`, `animated_image`).
   - Baixa os binários do CDN da Meta e salva localmente em `/uploads/ig_[timestamp]_[hash].[ext]`.
   - Formata as tags internas (`[ImageUrl:...]`, `[AudioUrl:...]`, `[VideoUrl:...]`, `[StickerUrl:...]`) para que o reprodutor do LiveChat exiba os arquivos nativamente.
4. **Filtro de Eco (`is_echo`):**
   - Ignora mensagens que a própria página envia, eliminando loops infinitos.
5. **Envio de Mensagens:**
   - O método `sendMessage(to, text)` envia as respostas via `POST /v20.0/me/messages` com payload `{ recipient: { id }, message: { text } }`.

---

## 4. Ciclo de Vida do Atendimento & Reabertura de Fila

* **Arquivo:** `src/services/ChatService.js`

### Problema Anterior:
Quando um atendimento do Instagram era finalizado pelo operador humano, o registro ficava marcado como `status: 'finished'`. Ao receber uma nova mensagem do mesmo cliente, o sistema não reposicionava o chamado na fila de espera, deixando os operadores sem notificação.

### Correção Aplicada:
A rotina `createOrUpdateChat` foi aprimorada com a seguinte regra:
- Se o chat existente estiver com status `'finished'`:
  1. O status é alterado imediatamente para `'waiting'` (Aguardando).
  2. Um **novo protocolo oficial** é gerado (`PROT-YYYYMMDD-XXXX`).
  3. Limpa o `attendantId`, CSAT e data de fechamento anterior.
  4. Reseta as sessões de URA e IA (`FlowService.resetSession`).
  5. Dispara evento Socket.IO `client-waiting` acompanhado de alerta sonoro para os atendentes.

---

## 5. Interface do Usuário (Frontend SPA / React)

* **Arquivo:** `client/src/views/ConnectionsView.jsx`

1. **Card de Conexão com Identidade Visual do Instagram:**
   - Ícone vetorial com cores oficiais da marca.
   - Botões de ação rápida: Iniciar, Parar, Reiniciar e Excluir.
2. **Modal de Cadastro Inteligente:**
   - Campos: **Nome da Conexão**, **ID da Página** e **Token de Acesso da Página**.
   - Box de instrução em tempo real contendo a **URL de Retorno** e o **Verify Token** baseados no domínio atual da aplicação.
3. **Filtro de Canais:**
   - Alternância rápida entre: *Todos*, *WhatsApp*, *Telegram* e *Instagram*.

---

## 6. Deploy e Execução em Produção (VPS)

Procedimentos realizados no servidor de produção (`108.174.145.160`):

```bash
# 1. Compilação do Frontend SPA
npm run build

# 2. Sincronização de código para o servidor
# (Arquivos sincronizados em /var/www/itecchatbot.com.br)

# 3. Reinício dos processos via PM2
pm2 reload itecchatbot

# 4. Teste de validação do Webhook via Terminal
curl -i -k "https://itecchatbot.com.br/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=itecchatbot_verify_token&hub.challenge=889911"
# Resposta esperada: HTTP/1.1 200 OK -> 889911
```

---

## 7. Tabela de Resolução de Problemas (Troubleshooting)

| Sintoma | Causa Mais Provável | Solução |
| :--- | :--- | :--- |
| **Meta acusa erro ao salvar a URL do Webhook** | Rota bloqueada por autenticação ou token divergente | Confirme se a URL é exatamente `https://itecchatbot.com.br/api/webhooks/instagram` e o token `itecchatbot_verify_token`. |
| **Mensagens enviadas no Instagram não chegam ao chat** | O aplicativo não foi inscrito nos eventos da página (`subscribed_apps`) | No menu **Conexões**, clique no botão **Reiniciar** da conexão do Instagram. O sistema fará a subscrição automaticamente via API. |
| **Apenas você consegue enviar mensagens, clientes não** | Aplicativo em Modo de Desenvolvimento na Meta | Acesse o painel da Meta e adicione os perfis de teste em **Funções do App** ou solicite a verificação da empresa para colocar o App em **Modo Produção**. |
| **Meta não entrega mensagens mesmo com tudo correto** | Permissão de acesso a mensagens desativada no app móvel | No Instagram no celular, acesse *Configurações ➔ Mensagens e respostas a stories ➔ Ferramentas para mensagens* e ative **"Permitir acesso às mensagens"**. |
| **Cliente mandou mensagem mas ela foi parar na aba Finalizados** | Conversa anterior encerrada sem reabertura de protocolo | Atualizado no `ChatService.js`. Ao chegar nova mensagem, o status é automaticamente redefinido para `waiting` com novo protocolo. |
