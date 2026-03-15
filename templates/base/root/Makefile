ifneq (,$(wildcard .env))
include .env
export
endif

POSTGRES_CONTAINER ?= {{projectName}}-postgres
POSTGRES_USER ?= postgres
POSTGRES_DB ?= {{projectName}}
POSTGRES_TEST_DB ?= {{projectName}}_test

.PHONY: help check test lint lint-fix fmt fmt-check typecheck dev db-reset

.DEFAULT_GOAL := help

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} \
	/^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } \
	/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Quality & Testing

check: ## Run format check, lint, typecheck and tests
	$(MAKE) fmt-check
	$(MAKE) lint
	$(MAKE) typecheck
	$(MAKE) test

test: ## Run tests
	bun run test

lint: ## Run linter
	bun run lint

lint-fix: ## Run linter and fix issues
	bunx oxlint --fix

fmt: ## Run formatter
	bun run format

fmt-check: ## Run formatter check
	bun run format:check

typecheck: ## Run type checker
	bun run typecheck

##@ Development

dev: ## Start development servers
	bun run dev

##@ Database

db-reset: ## Drop and recreate the main + test PostgreSQL databases
	@docker exec "$(POSTGRES_CONTAINER)" psql -U "$(POSTGRES_USER)" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$(POSTGRES_DB)\" WITH (FORCE);"
	@docker exec "$(POSTGRES_CONTAINER)" psql -U "$(POSTGRES_USER)" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$(POSTGRES_DB)\";"
	@docker exec "$(POSTGRES_CONTAINER)" psql -U "$(POSTGRES_USER)" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$(POSTGRES_TEST_DB)\" WITH (FORCE);"
	@docker exec "$(POSTGRES_CONTAINER)" psql -U "$(POSTGRES_USER)" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$(POSTGRES_TEST_DB)\";"
