# Progress Log

## Session: 2026-07-09

### Actions Taken
- Investigated Docker Compose, Django management command, wrapper script, SQL README, and command tests.
- Confirmed Docker and management command already define the desired main-then-division ordering.
- Identified the remaining gaps in the wrapper script and README.
- Added tests for missing division init SQL and wrapper forwarding of root password plus division SQL path.
- Watched the wrapper forwarding test fail before changing production files: `1 failed, 6 passed`.
- Updated `server/rebuild_initial_mysql_schema.ps1` to forward `--root-password` and optional `--division-init-sql-file`.
- Moved SQL files from `server/sql/mysql/init/` to root `sql/mysql/init/`.
- Moved SQL documentation from `server/sql/README.md` to `docs/sql.md`.
- Updated code, Docker Compose, README, deployment docs, database docs, and tests to use the new root SQL path.
- Confirmed no `server/sql` references remain via `rg`.
- Merged the former `docs/sql.md` content into `docs/database/数据库设计规范.md` under `全量初始化 SQL`.
- Updated README and deployment docs to link to the database design spec instead of `docs/sql.md`.
- Deleted the standalone `docs/sql.md`.

### Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Focused pytest | Command and metadata tests pass | `22 passed in 0.24s` | passed |
| Backend pytest | Full backend test suite passes | `206 passed in 26.49s` | passed |
| Migration dry-run | No model migration drift | `No changes detected` | passed |
| Git status | Review working tree state | `git status --short` returned clean before final planning log update | passed |
| SQL docs merge checks | No stale `docs/sql.md` links and no whitespace errors | `rg` found only new database spec links; `git diff --check` passed | passed |

### Errors
| Error | Resolution |
|-------|------------|
| PowerShell `pwsh` launcher failed with CreateProcessAsUserW error 5 | Use `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` |
| Cleaning `server/db.sqlite3` failed because escalation review returned 503 | Did not retry via workaround; leave exact status in final report |
