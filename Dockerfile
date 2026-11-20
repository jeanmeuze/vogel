# Optional: run outside Vercel (uses the in-memory store unless Upstash env vars are set).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json ./
COPY dev-server.js vercel.json ./
COPY api ./api
COPY lib ./lib
COPY public ./public
USER node
EXPOSE 3000
CMD ["node", "dev-server.js"]
