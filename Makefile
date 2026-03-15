.PHONY: help \
	check test lint lint-fix fmt fmt-check typecheck \
	commit clean update \
	dev

# =============================================================================
#  Help
# =============================================================================

.DEFAULT_GOAL := help

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} \
	/^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } \
	/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

# =============================================================================
#  Quality & Testing
# =============================================================================

##@ Quality & Testing

check: ## Run format, lint-fix, typecheck and tests
	$(MAKE) fmt
	$(MAKE) lint-fix
	$(MAKE) typecheck
	$(MAKE) test

test: ## Run tests
	bun run test

lint: ## Run linter
	bun run lint

lint-fix: ## Run linter and fix issues
	bunx oxlint --fix src tests bin vitest.config.ts

fmt: ## Run formatter
	bun run format

fmt-check: ## Run formatter check
	bun run format:check

typecheck: ## Run type checker
	bun run typecheck

# =============================================================================
#  Git & CI
# =============================================================================

##@ Git & CI

commit: ## Commit changes (runs quality pipeline + tests first)
	$(MAKE) check
	git add --all
	opencommit -y

# =============================================================================
#  Development
# =============================================================================

##@ Development

dev: ## Run CLI in development mode
	bun run dev

# =============================================================================
#  Dependencies & Cleanup
# =============================================================================

##@ Dependencies & Cleanup

clean: ## Remove node_modules, build artifacts, and caches
	bun x rimraf --glob \
		'{node_modules,coverage,dist,bun.lockb,bun.lock,.turbo,tsconfig.tsbuildinfo}'
	@if [ -t 0 ]; then \
		read -r -p "Reinstall dependencies now? [Y/n] " response; \
		case "$$response" in \
			[nN]*) echo "Skipping reinstall" ;; \
			*) echo "Installing dependencies..."; bun install ;; \
		esac; \
	else \
		echo "Installing dependencies..."; bun install; \
	fi

update: ## Interactive dependency update (taze)
	bun x taze --group --interactive
