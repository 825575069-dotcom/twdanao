# Findings & Decisions

## Findings
- `docker/compose.yml` already mounts `yesgo_init.sql` as `10-yesgo_init.sql` and `yesgo_division_init.sql` as `20-yesgo_division_init.sql`, so Docker's first-run init order is correct.
- Docker MySQL only runs `/docker-entrypoint-initdb.d` scripts when the MySQL data directory is empty. Existing `docker/volumes/mysql` data will not re-run newly added init files.
- `rebuild_initial_mysql_schema` already executes the main init SQL and then the division init SQL in full SQL mode.
- `server/rebuild_initial_mysql_schema.ps1` did not expose a `DivisionInitSqlFile` parameter and also did not pass `--root-password` to the management command.
- `server/sql/README.md` described only `yesgo_init.sql`, which could mislead manual operators into skipping `yesgo_division_init.sql`.
- User confirmed `server/sql/` should be migrated to root `sql/`, and SQL documentation should live under `docs/`.
- After migration, no `server/sql` references remain in README, docs, Docker, server code, or tests.

## Resources
- `docker/compose.yml`
- `server/apps/platform/management/commands/rebuild_initial_mysql_schema.py`
- `server/rebuild_initial_mysql_schema.ps1`
- `docs/sql.md`
- `server/tests/test_rebuild_initial_mysql_schema_command.py`
