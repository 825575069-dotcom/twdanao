# Task Plan: MySQL Division Init

## Goal
Ensure the MySQL initialization flow applies `yesgo_division_init.sql` immediately after `yesgo_init.sql`, and make the supported execution paths clear and verifiable.

## Current Phase
Complete

## Phases

### Phase 1: Investigation
- [x] Check Docker MySQL init ordering
- [x] Check `rebuild_initial_mysql_schema` command behavior
- [x] Check wrapper script and SQL README
- **Status:** complete

### Phase 2: Implementation
- [x] Update wrapper script so the division init SQL path can be passed explicitly
- [x] Move SQL files to root `sql/mysql/init/`
- [x] Move SQL README to `docs/sql.md`
- [x] Update SQL README with the main SQL then division SQL execution contract
- [x] Add regression coverage for missing division init SQL
- **Status:** complete

### Phase 3: Verification
- [x] Run focused tests
- [x] Run backend test suite
- [x] Run migration dry-run check
- [x] Check git status
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep migrations out of this fix | User explicitly said the project is not online and no migration files should be generated |
| Do not make backend startup destructively rebuild MySQL | Rebuilding or clearing a database on normal container start would be unsafe |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Default `pwsh` launch failed with CreateProcessAsUserW error 5 | Initial skill/file reads | Switched to system Windows PowerShell |
