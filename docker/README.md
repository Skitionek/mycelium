# Getting Started with Mycelium using Docker

Docker is an easy way to get started with Mycelium.

## Prerequisites

- [Docker](https://www.docker.com/get-started)

## Run locally

In order to build and bring up all required containers, run the following command after cloning this repository:

Once it's running, you can access the Mycelium UI at [http://localhost:8080](http://localhost:8080) in your browser.
Default username / password is: `admin@example.com` / `password`

```shell
make up
```

```text
Building and running containers...
This may take a while if running for the first time. 

[+] Running 13/13
 ⠿ Network mycelium                             Created
 ⠿ Volume "mycelium_postgres"                   Created
 ⠿ Volume "mycelium_elasticsearch"              Created
 ⠿ Volume "mycelium_neo4j"                      Created
 ⠿ Container mycelium-neo4j-1                   Started
 ⠿ Container mycelium-postgres-1                Started
 ⠿ Container mycelium-pdfparser-1               Started
 ⠿ Container mycelium-elasticsearch-1           Started
 ⠿ Container mycelium-redis-1                   Started
 ⠿ Container mycelium-statistical-enrichment-1  Started
 ⠿ Container mycelium-cache-invalidator-1       Started
 ⠿ Container mycelium-appserver-1               Started
 ⠿ Container mycelium-frontend-1                Started

To access Mycelium, point your browser at: http://localhost:8080
```

## Architecture diagram

![Architecture diagram](diagram.svg)

## Customize

The stack definition is divided into three Docker Compose files:

```tree
├── docker-compose.yml           --> Base core services
├── docker-compose.dev.yml       --> Overrides base core services for local development and debugging.
└── docker-compose.services.yml  --> Adds third party services (PostgreSQL, Neo4j, Elasticsearch, Redis)
```

You may combine them as you need and/or add your own `docker-compose.override.yml` to override any configuration. (this file will be ignored by Git)

## Office file thumbnails (optional)

The frontend can show thumbnails of Word, Excel, PowerPoint and OpenDocument files, in the
file tiles and the file preview panel. They are rendered in the visitor's browser by
[serverless-office-converter](https://github.com/Skitionek/serverless-office-converter)
(LibreOffice compiled to WebAssembly), so the server does no extra work. They are off by
default. To switch them on, build the frontend image with the converter:

```shell
docker build client --build-arg OFFICE_CONVERTER_REF=main -t mycelium-frontend
```

`OFFICE_CONVERTER_REF` is a branch, tag or commit of the converter. It adds about 45 MB to the
image and turns on `OFFICE_THUMBNAILS`. Set `OFFICE_THUMBNAILS=off` on the container (with
Helm, `frontend.extraEnv`) to switch thumbnails off again without rebuilding.

With thumbnails on, nginx sends `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: credentialless`, because the converter needs a cross-origin
isolated page. Windows Mycelium opens on other sites lose their link to it (`window.opener`).
Browsers that don't support `credentialless` show file type icons as before.

Thumbnails are rendered so that they don't slow down the rest of Mycelium:

- Nothing is loaded until a thumbnail is on screen that hasn't been rendered yet. Only then
  does the browser load the converter (about 45 MB the first time, then from its cache).
- Files are downloaded and converted one at a time, when the browser is idle. Thumbnails use
  at most one of the browser's connections to the server, and conversions run in a Web Worker,
  off the page's main thread.
- Thumbnails that leave the screen are dropped from the queue, and a download in progress is
  stopped. Files larger than 25 MB are skipped.
- The converter is stopped after a minute without work, releasing its memory (up to about
  1 GB). Each version of a file is converted at most once while the page is open, and a file
  that can't be converted isn't tried again.

## Other Docker operations

You can run `make help` to see other available common operation:

```text
usage: make [target]

docker:
  up                              Run all container(s). [c=<names>]
  up-dev                          Build and run all container(s) for development. [c=<names>]
  images                          Build container(s) for distribution.
  status                          Show container(s) status. [c=<names>]
  logs                            Show container(s) logs. [c=<names>]
  restart                         Restart container(s). [c=<names>]
  stop                            Stop containers(s). [c=<names>]
  exec                            Execute a command inside a container. [c=<name>, cmd=<command>]
  test                            Execute test suite
  down                            Destroy all containers and volumes
  diagram                         Generate an architecture diagram from the Docker Compose files
```
