# 🤖 ItecChatbot - Plataforma Omnichannel & Gestão de Atendimento Inteligente

**ItecChatbot** é uma plataforma corporativa completa de atendimento omnichannel, automação com Inteligência Artificial (**OpenAI**) e mensageria via **WhatsApp** (engine Baileys). O sistema foi arquitetado para operações de alta escala, oferecendo multi-tenancy (isolamento por empresa), URA interativa, distribuição de fila com transbordo inteligente, chat ao vivo colaborativo e disparador de campanhas anti-ban.

---

## 🌟 Visão Geral das Funcionalidades

### 🏢 1. Multi-Tenancy & Segurança Corporativa
* **Isolamento de Empresas:** Cada empresa possui seus próprios bots, filas, atendentes, contatos e histórico.
* **Segurança e Criptografia:** Criptografia de ponta a ponta (AES-256-CBC) para credenciais e dados sensíveis, além de autenticação via tokens JWT com chaves exclusivas.
* **RBAC & Cargos Personalizados:** Controle de acesso granular por módulo/tela (Atendimento, Vendas, Supervisão, Gestão Completa) e setores cadastrados.
* **Trilha de Auditoria (Audit Logs):** Rastreabilidade total de logins, transferências, exclusões e alterações cadastrais.

### 📞 2. Centralização de Atendimentos & Autoatendimento URA
* **Menu Interativo (1, 2, 3...):** Triagem automática rápida com construtor visual e simulador de WhatsApp em tempo real.
* **Transbordo Inteligente de Fila (Fallback):** Caso o cliente selecione um setor sem atendentes online no momento, o sistema envia uma mensagem amigável e redireciona automaticamente para a Fila Geral de Plantão.
* **Timeout & Lembrete por Inatividade:** Reengajamento automático com lembrete após X minutos de silêncio e auto-encerramento com despedida após tempo limite.
* **Modos de Destino Dinâmicos:** Direcionamento para Setor específico, Atendente nominal, Resposta Informativa ou Agente Autônomo de Inteligência Artificial.

### 💬 3. Chat ao Vivo Profissional (LiveChat)
* **Transferência Rápida em 3 Modos:**
  1. *🏢 Setor / Equipe:* Com indicador de operadores vinculados e status de disponibilidade.
  2. *🧑‍💼 Atendente:* Com contador de conversas ativas em tempo real.
  3. *🔄 Fila Geral:* Devolução à fila de espera compartilhada.
  * *Observação Interna:* Registro de notas privadas para o próximo atendente com histórico auditável.
  * *Notificação WhatsApp:* Aviso opcional automático ao cliente informando o redirecionamento.
* **Notas Internas Privadas (Modo Amarelo):** Troca de plantão e anotações confidenciais entre operadores com badge de cadeado `🔒 Nota Interna`, 100% blindadas e nunca enviadas ao WhatsApp.
* **Resumo Inteligente com IA:** Geração instantânea de sumário das conversas com 1 clique (alimentado por GPT).
* **Mídias e Comunicação Rica:** Áudios gravados com envio nativo (PTT), player com velocidade ajustável (1x, 1.5x, 2x), envio de PDFs, imagens e figurinhas (stickers).
* **Gestor de Etiquetas (Tags):** Categorização com tags coloridas por atendimento e nomenclatura personalizada por operador.

### 🧠 4. Inteligência Artificial Integrada (OpenAI)
* **Agentes Especializados:** Instruções personalizadas por empresa/bot com controle de temperatura e modelo (GPT-4o, GPT-4o-mini).
* **Base de Conhecimento:** Treinamento com arquivos de perguntas frequentes e documentações corporativas.
* **Takeover Transparente:** Transição suave entre IA e humano com pausa de automação quando um atendente assume a conversa.

### 🚀 5. Campanhas em Massa Anti-Ban
* **Disparador em Lote:** Envio de avisos, promoções e comunicados para listas segmentadas.
* **Proteção Anti-Ban:** Intervalos randômicos e inteligentes entre mensagens para preservar a integridade do chip/número.
* **Personalização Dinâmica:** Variáveis como `{{nome}}` e relatório de status por envio.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologias |
| :--- | :--- |
| **Backend** | Node.js (v20+), Express.js, Socket.IO, PostgreSQL (`pg`) |
| **Frontend** | React 19, Vite, Lucide Icons, Vanilla CSS Design System |
| **Conexão WhatsApp** | `@whiskeysockets/baileys` com reconexão resiliente e persistência |
| **Inteligência Artificial** | OpenAI API (GPT-4o / GPT-4o-mini) |
| **Processos & Deploy** | PM2, Docker, Docker Compose, Nginx |
| **Criptografia & Hash** | AES-256-CBC, JWT, Scrypt |

---

## 📂 Estrutura do Repositório

```
itecchatbot/
├── client/                      # Frontend SPA moderno (React + Vite)
│   ├── src/
│   │   ├── components/          # Componentes (CentralMenuBuilder, modais, etc.)
│   │   ├── context/             # Contexto de Autenticação e Estados
│   │   ├── services/            # Camada de comunicação HTTP e WebSockets
│   │   └── views/               # Telas principais (LiveChat, Dashboard, Conexões, Usuários)
│   └── dist/                    # Bundle de produção compilado
├── src/                         # Backend Node.js / Express
│   ├── config/                  # Constantes, diretórios e configurações
│   ├── controllers/             # Controladores REST
│   ├── database/migrations/     # Migrações SQL versionadas
│   ├── middlewares/             # Autenticação JWT, Rate Limit, Criptografia
│   ├── routes/                  # Rotas da API
│   ├── services/                # Regras de Negócio (Chat, Flow, RoundRobin, BotManager)
│   ├── utils/                   # Utilitários (Patch Baileys, Criptografia AES)
│   ├── app.js                   # Configuração dos middlewares Express e SPA
│   └── server.js                # Inicialização HTTP, Socket.IO e inicialização de bots
├── deploy-vps.js                # Script automatizado de deploy via SSH/SFTP para o VPS
├── docker-compose.yml           # Orquestração de contêineres (App, PostgreSQL, Redis)
└── Dockerfile                   # Imagem Docker multi-stage de produção
```

---

## ⚙️ Instalação e Execução Local

### Pré-requisitos
* **Node.js** v18 ou v20+ instalado.
* **PostgreSQL** ativo (porta padrão 5432).

### 1. Configurar o `.env`
Crie ou configure o arquivo `.env` na raiz do projeto:

```env
PORT=3000
HOST=0.0.0.0
DB_HOST=localhost
DB_PORT=5432
DB_USER=seu_usuario_postgres
DB_PASSWORD=sua_senha_postgres
DB_NAME=chatbots2
OPENAI_API_KEY=sk-proj-sua-chave-aqui
ENCRYPTION_KEY=defina_uma_chave_hex_32_bytes_ex_openssl_rand_hex_16
JWT_SECRET=defina_um_segredo_jwt_longo_e_exclusivo_com_64_caracteres
INITIAL_ADMIN_PASSWORD=SuaSenhaForteAqui123!
```

### 2. Instalar Dependências e Iniciar

```bash
# 1. Instalar dependências da API
npm install

# 2. Instalar dependências e compilar o Frontend
cd client
npm install
npm run build
cd ..

# 3. Iniciar em modo de desenvolvimento
npm run dev

# Ou iniciar em modo de produção
npm start
```

Acesse no navegador: `http://localhost:3000`

---

## 🔑 Credenciais do Administrador (Bootstrap)

Ao inicializar o banco pela primeira vez, o superusuário é configurado automaticamente com:

* **E-mail:** `suporte@itecchatbot.com.br`
* **Senha:** Definida pela variável `INITIAL_ADMIN_PASSWORD` no `.env` (ou gerada de forma segura e exibida no console na primeira inicialização).

---

## 📄 Licença
Distribuído sob licença comercial proprietária para **ItecChatbot**. Todos os direitos reservados.