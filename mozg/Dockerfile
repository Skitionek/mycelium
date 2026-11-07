# Node 26 on Debian 13 (trixie), the base Mozg's own Dockerfile uses: Mozg
# needs Node >= 22, and sqlite3's prebuilt binding needs glibc 2.38, which
# Debian 12 lacks (and Alpine's musl has no prebuild at all), so this base
# needs no compiler toolchain.
ARG NODE_TAG=26-trixie-slim

FROM node:${NODE_TAG} AS source

# Revision of https://github.com/Skitionek/Mozg this stack is built against.
# Pinned rather than tracking main: the queries in appserver and
# statistical-enrichment depend on specific driver behaviour (how the REST
# driver maps `where` to query parameters, how the KEGG driver reads
# `_pathSuffix`), so an unpinned clone would silently change what those
# services talk to. Bump deliberately, and re-run the Mozg-backed tests.
ARG MOZG_REVISION=c5dfd8c2adf89dae0e449ff4fae9e3bc629a34cb

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git init -q . \
    && git remote add origin https://github.com/Skitionek/Mozg.git \
    && git fetch -q --depth 1 origin "${MOZG_REVISION}" \
    && git checkout -q FETCH_HEAD

FROM node:${NODE_TAG} AS deps
WORKDIR /app
COPY --from=source /src/package.json /src/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:${NODE_TAG}
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=source /src/package.json ./
COPY --from=source /src/src ./src
COPY --from=source /src/public ./public
COPY --from=source /src/examples/queries.json /src/examples/blog.ttl ./examples/

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
