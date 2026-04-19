FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git

# Clone and install Mozg
RUN git clone --depth 1 https://github.com/Skitionek/Mozg.git . \
    && npm ci --omit=dev

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
