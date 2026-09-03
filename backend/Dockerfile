FROM node:20-slim

WORKDIR /app

# Install deps first for better layer caching
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
# Cloud Run injects PORT; server.js reads process.env.PORT with an 8080 default.

CMD ["node", "src/server.js"]
