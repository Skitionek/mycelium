FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git

# Clone and install Mozg, then hand ownership to the non-root node user
RUN git clone --depth 1 https://github.com/Skitionek/Mozg.git . \
    && npm ci --omit=dev \
    && chown -R node:node /app

EXPOSE 4000

ENV NODE_ENV=production

HEALTHCHECK --start-period=15s \
    CMD node -e "require('http').get('http://localhost:4000/graphql',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

USER node

CMD ["node", "src/index.js"]
