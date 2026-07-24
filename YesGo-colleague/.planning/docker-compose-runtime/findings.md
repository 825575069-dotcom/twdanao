# Findings & Decisions

## Requirements
- Docker Compose should be able to start Django backend and Vue web app, not only dependency services.
- Target mode is local development: Django `runserver`, Vite dev server, mounted source, and hot reload.
- The repository requires Docker-first runtime assets under `docker/`; do not introduce `infra/`.
- Real business environment variables belong in root `.env`; `docker/` should keep compose/image build files and environment examples only.
- Long tasks must be tracked with `planning-with-files` and executed with `superpowers` workflow.

## Research Findings
- Planning files were initialized under `.planning/docker-compose-runtime/`.
- `.planning/.active_plan` points to `docker-compose-runtime`.
- Direct execution of `.ps1` scripts is blocked by local PowerShell execution policy; `powershell -ExecutionPolicy Bypass -File ...` works for project-local planning scripts.
- `docker/compose.yml` already defines `backend`, `web`, `mysql`, and `redis` services.
- `backend` builds from `docker/backend.Dockerfile`, mounts `../server:/app/server`, reads `../.env`, waits for healthy MySQL and started Redis, and exposes `${BACKEND_PORT:-8000}:8000`.
- `web` builds from `docker/web.Dockerfile`, mounts `../web:/app`, uses `docker/volumes/web/node_modules` for dependencies, depends on `backend`, and exposes `${WEB_PORT:-5173}:5173`.
- `docker/backend.Dockerfile` currently installs Python dependencies inline and starts `python manage.py ensure_mysql_database && python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000`.
- `docker/web.Dockerfile` currently uses `node:20-alpine`, installs dependencies on container start if Vite is missing, and runs `yarn dev --host 0.0.0.0`.
- `docker/.env.example` contains local sample values for MySQL, ports, and Redis URL.
- `server/yesgo/settings.py` requires `DJANGO_SECRET_KEY`; the root `.env` has it, but `docker/.env.example` does not document it.
- `server/yesgo/settings.py` switches to MySQL when `MYSQL_HOST` is set; Compose sets `MYSQL_HOST=mysql`, so backend will use the MySQL container.
- `web/vite.config.ts` proxies `/api` to `http://127.0.0.1:8000`; inside the web container this points to the web container itself, not the `backend` service. Container mode likely needs `http://backend:8000` or an env-driven proxy target.
- `web/src/api/http.ts` uses `VITE_API_BASE_URL || ""`; leaving it empty relies on Vite proxy for local dev.
- Root `.env` currently contains real local business/integration values, including Dify keys. Compose uses `../.env`, so `docker/.env.example` should remain only an example and should not become the real business config source.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Treat `docker-compose-runtime` as the active plan id | Matches the current goal and keeps future plans separate |
| Use scoped `.planning/<task-id>/` files instead of root `task_plan.md` | Avoids cluttering project root and supports multiple long tasks |
| Implement development-mode Compose first | User selected local development mode over production/demo mode |
| Close the plan as achieved | User confirmed the Docker Compose goal has already been achieved |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| PowerShell refused direct `.ps1` execution | Use `powershell -ExecutionPolicy Bypass -File` when invoking the planning helper scripts |

## Resources
- `AGENTS.md`
- `.codex/skills/planning-with-files/SKILL.md`
- `docker/compose.yml`
- `docker/backend.Dockerfile`
- `docker/web.Dockerfile`
- `docker/.env.example`
- `server/yesgo/settings.py`
- `server/pyproject.toml`
- `web/vite.config.ts`
- `web/package.json`
- `web/src/api/http.ts`
- `.planning/docker-compose-runtime/task_plan.md`
- `.planning/docker-compose-runtime/progress.md`
