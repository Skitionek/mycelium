# ========================================
# Base image
# ========================================
FROM python:3.10 as base

ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONFAULTHANDLER 1

RUN pip install uv


# ========================================
# Build dependencies stage
# ========================================
FROM base as build-deps

# Install build dependencies
RUN apt-get update \
    && apt-get install -y liblmdb-dev python3-dev libxml2-dev libxslt-dev build-essential \
    && apt-get clean

# Copy dependency files
COPY requirements.txt requirements-dev.txt ./

# Install Python dependencies
ARG DEV
RUN uv venv /.venv \
    && uv pip install --python /.venv/bin/python -r requirements.txt \
    && if [ -n "$DEV" ]; then uv pip install --python /.venv/bin/python -r requirements-dev.txt; fi


# ========================================
# Runtime stage
# ========================================
FROM base
LABEL org.opencontainers.image.source https://github.com/Skitionek/mycelium

# Install runtime system dependencies
RUN apt-get update \
    && apt-get install -y libmagic-dev graphviz libgraphviz-dev libreoffice \
    && apt-get clean

# Copy Python virtual environment
COPY --from=build-deps /.venv /.venv
ENV PATH="/.venv/bin:$PATH"

# Set user and workdir
WORKDIR /app
RUN useradd -m -d /app app
USER app

# Copy application code
COPY --chown=app . .

# Set to 1 to automatically apply any pending DB migrations at startup
ENV MIGRATE_DB=

# Create an initial admin user
ENV INITIAL_ADMIN_EMAIL=

# LMDB database volume
ENV LMDB_DATA_DIR=/lmdb
VOLUME /lmdb

# LMDB download cloud storage
# ENV AZURE_ACCOUNT_STORAGE_NAME=
# ENV AZURE_ACCOUNT_STORAGE_KEY=

# JWT Authendication
ENV JWT_SECRET=secret

# Base URL of this app, reachable by external services
ENV APPSERVER_URL=http://localhost:5000

# Base URL of the frontend app, for link generation
ENV FRONTEND_URL=http://localhost:4242

# PostgreSQL configuration
ENV POSTGRES_HOST=postgres
ENV POSTGRES_PORT=5432
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres
ENV POSTGRES_DB=postgres

# Neo4j configuration
ENV NEO4J_HOST=neo4j
ENV NEO4J_PORT=7687
ENV NEO4J_AUTH=neo4j/password
ENV NEO4J_DATABASE=neo4j
ENV NEO4J_SCHEME=bolt

# Solr configuration
ENV SOLR_URL=http://solr:8983/solr
ENV SOLR_FILE_COLLECTION=file

# Statistical enrichment service
ENV STATISTICAL_ENRICHMENT_URL=http://statistical-enrichment:5000

# PDFParser service
ENV PDFPARSER_URL=http://pdfparser:7600

# NLP Processing service
ENV NLP_URL=https://placeholder
ENV NLP_SECRET=secret

# Mailserver configuration
ENV FROM_EMAIL=mycelium@example.com

# Sendgrid integration
ENV SENDGRID_API_KEY=

# Optional Sentry logging configuration
ENV SENTRY_DSN=

# Optional Elastic APM configuration.
# To enable, at least ELASTIC_APM_SERVER_URL must be set
# Other available variables: https://www.elastic.co/guide/en/apm/agent/python/master/configuration.html
ENV ELASTIC_APM_SERVER_URL=
ENV ELASTIC_APM_SERVICE_NAME=appserver

# Flask env (development, testing, production)
ENV FLASK_ENV=production

# Listen port
ENV PORT=5000
EXPOSE $PORT

# Health check by requesting system info to /meta endpoint
HEALTHCHECK --start-period=30s \
    CMD curl -f localhost:$PORT/meta || exit 1

RUN chmod +x bin/docker-entrypoint.sh
ENTRYPOINT ["/app/bin/docker-entrypoint.sh"]
