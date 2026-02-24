# OZMirror — Claude Code Guidelines

## Session Start

At the beginning of every new session:
1. Run `git fetch origin && git checkout main && git pull origin main` to ensure you are working from the latest `main`
2. Read the key source files to load the codebase into context before making any changes — at minimum: `CLAUDE.md`, `frontend/src/`, `backend/`, and any files directly relevant to the task

## Branching & PRs

- **Never commit directly to `main`**
- All changes must go through a feature/fix branch and a pull request
- Branch naming: `fix/<short-description>`, `feat/<short-description>`, `chore/<short-description>`
- Create the PR with `gh pr create` after pushing the branch

## Deployment

The server runs on a dedicated Linux machine. Always use `make deploy` (not `docker compose up`) after pulling new code — it rebuilds images so code changes actually take effect.

```bash
make deploy   # git pull + rebuild all images + restart
```

See the Makefile for all available commands (`make help`).

## CORS

The dashboard is accessed at `https://ozmirror.azuriki.com`. Any new domain or IP that needs write access (`PUT`/`DELETE`) must be added to:
1. `ALLOWED_ORIGINS` and `ALLOWED_CORS_ORIGINS` in `.env`
2. The `map $http_origin $allow_origin` block in `nginx/nginx.conf`

Omitting either causes layout saves to silently fail with 422.
