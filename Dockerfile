# Optional: run outside Vercel. Needs DATABASE_URL (Postgres/Neon).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY dev-server.js vercel.json ./
COPY api ./api
COPY lib ./lib
COPY public ./public
USER node
EXPOSE 3000
CMD ["node", "dev-server.js"]
