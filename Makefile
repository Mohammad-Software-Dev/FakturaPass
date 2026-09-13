.PHONY: dev verify setup
setup:
	npm ci
	npm run engine:setup
dev:
	npm run dev
verify:
	npm run verify
