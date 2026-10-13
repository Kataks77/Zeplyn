FROM node:20-slim

# Instalar ffmpeg e utilitários essenciais
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependências aproveitando o cache de camadas do Docker
COPY package*.json ./
RUN npm ci --omit=dev || npm install --production

# Copiar restante do código da aplicação
COPY . .

# Criar diretórios de dados se não existirem
RUN mkdir -p uploads temp temp_audio auth_info bot-configs extracted_texts

# Porta padrão da aplicação
EXPOSE 3000

# Variáveis padrão
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "src/server.js"]
