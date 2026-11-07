FROM node:20-alpine

WORKDIR /app

# Revision of https://github.com/Skitionek/Mozg this stack is built against.
# Pinned rather than tracking main: the queries in appserver and
# statistical-enrichment depend on specific driver behaviour (how the REST
# driver maps `where` to query parameters, how the KEGG driver reads
# `_pathSuffix`), so an unpinned clone would silently change what those
# services talk to. Bump deliberately, and re-run the Mozg-backed tests.
ARG MOZG_REVISION=fd1e9e892e1c760e069308ee57506d72c407f1c5

RUN apk add --no-cache git

# sqlite3 ships no musl prebuild, so it is compiled from source here.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && git init -q . \
    && git remote add origin https://github.com/Skitionek/Mozg.git \
    && git fetch -q --depth 1 origin "${MOZG_REVISION}" \
    && git checkout -q FETCH_HEAD \
    && npm ci --omit=dev \
    && npm cache clean --force \
    && apk del .build-deps \
    && chown -R node:node /app

EXPOSE 4000

ENV NODE_ENV=production

HEALTHCHECK --start-period=15s \
    CMD node -e "require('http').get('http://localhost:4000/graphql',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

USER node

CMD ["node", "src/index.js"]
