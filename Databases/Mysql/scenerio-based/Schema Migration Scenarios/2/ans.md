# Safe Column Dropping in Production: Expand-Contract Pattern

Perfect 🔥 — let's deep dive into Schema Migration Scenario Q2:

👉 "You need to drop a column but some services still use it. How do you safely migrate in a production distributed system (Node.js backend, Kubernetes, MySQL RDS)?"

This is trickier than adding a column — because dropping is destructive. If you move too fast, you'll break services still reading/writing that column.

## 🔹 1. Challenges in Dropping a Column

- Services may still read the column.
- Some services may still write/update it.
- In distributed systems (Kubernetes microservices, multiple teams), you may not even know who's using it.

Dropping directly can:
- Cause queries to fail (Unknown column 'X').
- Cause app crashes.

👉 That's why big-tech companies use **Expand → Contract** for safe column removal.

## 🔹 2. Expand → Contract for Dropping a Column

### ✅ Step 1: Detect Usage

Before touching the schema:

1. Enable MySQL query logging (general log, performance_schema, or ProxySQL query log).
2. Search for references to the column:

```sql
SELECT * FROM performance_schema.events_statements_summary_by_digest 
WHERE DIGEST_TEXT LIKE '%dropped_column%';
```

3. Check application logs (Node.js error traces, ORM queries).
4. Make a list of services still using this column.

👉 In AWS RDS, you can also enable **Enhanced Monitoring + Performance Insights** to find queries using that column.

### ✅ Step 2: App Code Expand Phase

Deploy application code that stops relying on this column.

Examples:
- **Reads** → stop selecting the column.
- **Writes** → stop updating/inserting it.

Example in Node.js (Sequelize/Knex before fix):

```javascript
// Old code
const [rows] = await db.query("SELECT id, email, legacy_status FROM users");
```

Fixed code (safe):

```javascript
// New code
const [rows] = await db.query("SELECT id, email FROM users");
```

👉 Deploy this change across all services in Kubernetes.

### ✅ Step 3: Dual-Write / Shadow Migration (if needed)

If column still has business value (e.g., `legacy_status` → `user_state`), you must migrate data to its replacement column before dropping.

1. Create new column `user_state`.
2. Update code to dual write (`legacy_status` + `user_state`).
3. Backfill old data into new column.
4. Verify new column is being used successfully.

### ✅ Step 4: Contract Phase (Schema Cleanup)

Once you are 100% sure:
- No service queries the old column.
- New column (if replacement exists) is fully populated.

👉 Now safely drop the column with an online tool (gh-ost / pt-osc):

```bash
gh-ost \
  --host=my-primary-db.rds.amazonaws.com \
  --user=admin \
  --password=xxxx \
  --database=myapp \
  --table=users \
  --alter="DROP COLUMN legacy_status" \
  --allow-on-master \
  --execute
```

This avoids replication lag (as explained in Q1).

### ✅ Step 5: Verification

Run query checks:

```sql
SHOW COLUMNS FROM users LIKE 'legacy_status';
```

→ should return empty.

- Confirm app logs → no more errors about missing column.
- Monitor CloudWatch ReplicaLag → ensure replicas didn't fall behind.

### ✅ Step 6: Rollback Plan

If app breaks unexpectedly:
- Restore old schema (in MySQL you'd need to re-add the column with `ALTER TABLE`).
- If column had critical data → restore from backup or binary logs.

That's why step 2 (stopping usage first) is critical — rollback should rarely be needed if services were fixed beforehand.

## 🔹 3. Real-World Example: Dropping `legacy_status`

1. **Detect usage**: Logs show `payments-service` and `analytics-service` still query `legacy_status`.
2. **Work with teams**: Deploy new code removing `legacy_status` queries.
3. **If migrating to new column** (`user_state`), dual-write and backfill.
4. **After 2 weeks** → no queries to `legacy_status` in logs.
5. **Run** `gh-ost --alter="DROP COLUMN legacy_status"`.
6. **Verify**.

## 🔹 4. Kubernetes Deployment Flow

- **Phase 1**: DB untouched, deploy Node.js code ignoring the column (Expand).
- **Phase 2**: DB column dropped after safe window (Contract).

Kubernetes rolling updates ensure old pods are drained and replaced with new code that doesn't reference the column.

## 🔹 5. Key Best Practices (Big-Tech Style)

- **Detect column usage first** (query logs).
- **App code comes first**: stop using the column before dropping.
- **Wait period** (1–2 weeks) to catch stragglers.
- **Feature flags**: keep toggle to switch back to old behavior if needed.
- **Schema changes via gh-ost/pt-osc** for zero downtime.
- **Rollback strategy**: re-add column from backup if needed.

## ✅ Summary

To drop a column safely in production (Node.js + RDS + Kubernetes):

1. **Detect** which services still use it (query logs).
2. **Deploy** app code that ignores/replaces it (Expand).
3. **If needed**, migrate data into replacement column.
4. **After safe window**, drop column with gh-ost (Contract).
5. **Verify**, monitor, and roll back if issues.