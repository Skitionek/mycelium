#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/mycelium

COMPOSE_ARGS=(
	-p mycelium
	-f docker/docker-compose.yml
	-f docker/docker-compose.services.yml
	-f docker/docker-compose.dev.yml
)

run_compose() {
	docker compose "${COMPOSE_ARGS[@]}" up -d --build --wait
}

set_host_workspace_path() {
	if [[ -n "${HOST_WORKSPACE_PATH:-}" ]]; then
		return 0
	fi

	local host_workspaces_root
	host_workspaces_root="$({
		docker ps -q | xargs -r docker inspect \
			--format '{{range .Mounts}}{{if eq .Destination "/workspaces"}}{{println .Source}}{{end}}{{end}}' 2>/dev/null
	} | sed -n '/./{p;q;}')"

	if [[ -z "$host_workspaces_root" ]]; then
		return 0
	fi

	export HOST_WORKSPACE_PATH="$host_workspaces_root/$(basename "$PWD")"
	echo "Using Docker host workspace path: $HOST_WORKSPACE_PATH"
}

retry_with_compatible_api_if_needed() {
	local err_log
	local max_api
	err_log="$(mktemp)"

	if run_compose 2> >(tee "$err_log" >&2); then
		rm -f "$err_log"
		return 0
	fi

	max_api="$(sed -n 's/.*Maximum supported API version is \([0-9.]\+\).*/\1/p' "$err_log" | tail -n 1)"
	rm -f "$err_log"

	if [[ -z "$max_api" ]]; then
		return 1
	fi

	echo "Detected Docker API mismatch. Retrying with DOCKER_API_VERSION=$max_api"
	DOCKER_API_VERSION="$max_api" run_compose
}

echo "Building and starting the full Mycelium stack (development mode)..."
set_host_workspace_path
retry_with_compatible_api_if_needed

echo "Mycelium stack is ready. The client will be available on http://localhost:4200"
