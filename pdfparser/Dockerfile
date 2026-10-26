FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev && npm cache clean --force

COPY src/ ./src/

EXPOSE 7600

ENV NODE_ENV=production

HEALTHCHECK --start-period=10s --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:7600/ || exit 1

USER node

CMD ["node", "src/server.mjs"]
