okay but we do not have to write any commad mnually like below Create a shadow table with the new schema: CREATE TABLE users_ghost LIKE users; ALTER TABLE users_ghost ADD COLUMN last_login_at DATETIME NULL; Copy rows in small chunks (e.g., 1000 rows per batch): INSERT INTO users_ghost SELECT * FROM users WHERE id BETWEEN 1 AND 1000; Each chunk is logged in the binlog as normal INSERTs. Replicas can apply them gradually. No huge blocking transaction. Keep shadow table in sync with triggers or binlog parsing: CREATE TRIGGER ghost_insert AFTER INSERT ON users FOR EACH ROW INSERT INTO users_ghost (...) VALUES (...); Or, in gh-ost, by reading binlogs directly. Ensures that new writes to users are mirrored to users_ghost. Cutover: Once shadow = original, lock briefly (<1s), rename tables: RENAME TABLE users TO users_old, users_ghost TO users; these are handled by tool itself?


# Manual vs Tool-Based Database Schema Changes

## 🔹 What You Would Do Manually vs What Tool Does

### Without a tool (manual way)

You would:
1. Create the ghost/shadow table.
2. Copy rows in chunks (lots of custom scripting).
3. Add triggers to keep ghost in sync.
4. Monitor replication lag + throttle.
5. Rename tables atomically at the end.

👉 **Very error-prone, risky, and painful at scale.**

### With a tool (e.g., `gh-ost`)

You just run a **single command**, like:

```bash
gh-ost \
  --host=my-primary-db.rds.amazonaws.com \
  --user=admin \
  --password=xxxx \
  --database=myapp \
  --table=users \
  --alter="ADD COLUMN last_login_at DATETIME NULL" \
  --allow-on-master \
  --cut-over=default \
  --chunk-size=1000 \
  --max-load=Threads_running=25 \
  --critical-load=Threads_running=100 \
  --execute
```

The tool then:
1. Creates the shadow (`users_ghost`).
2. Replays row copies in small batches.
3. Reads binlogs (not triggers, in gh-ost's case) to keep `users_ghost` up-to-date.
4. Monitors load + replication lag (pauses if lag too high).
5. Does the **atomic rename** (`RENAME TABLE`) in sub-second.

👉 **From your perspective → one safe command instead of dozens of SQL steps.**