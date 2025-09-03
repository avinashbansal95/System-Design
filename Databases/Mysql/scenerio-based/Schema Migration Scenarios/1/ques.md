Q1: You need to add a new column to a table with 1B rows in RDS MySQL production. How do you do it without downtime?

# Zero-Downtime Schema Migration for Billion-Row Tables

**Scenario:** "You need to add a new column to a table with 1B rows in RDS MySQL production. How do you do it without downtime, assuming a Node.js backend in a big-tech style app?"

This is a classic problem (e.g., adding `last_login_at` or `status` column to a massive `users` table).

## 1. Challenges in Production

`ALTER TABLE` on MySQL with 1B rows = table lock → downtime hours.

Even if ALTER is "online," it can cause:
- Replication lag (replicas struggle to keep up).
- Table-level locks during metadata change.

Big-tech systems require:
- Zero downtime.
- Backward-compatible migrations.
- Rollback plan.

## 2. Step-by-Step Walkthrough

### Step 1: Plan the Migration

Identify what column to add. Example:

```sql
ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL;
```

**Validate:**
- Is it nullable? (important → avoids backfilling immediately).
- Does it need a default? (dangerous for huge tables — causes rewrite).
- Is it read/write critical?

**Best practice:** Always add column as `NULL` first (cheap, metadata-only change).

### Step 2: Choose Migration Tool

At scale, don't run `ALTER TABLE` directly. Use online migration tools:

- **gh-ost** (by GitHub) → safe, online.
- **pt-online-schema-change** (by Percona).

These tools:
- Create a shadow table with new schema.
- Copy rows gradually (chunk by chunk).
- Apply changes via binlog triggers.
- Swap old ↔ new table at the end with minimal lock.

### Step 3: Node.js App Preparation

Add backward-compatible code:
- Deploy backend that doesn't depend on new column (just ignores it).
- Write paths: Ensure app can handle column absence.

**Example (Sequelize/Knex migration definition):**

```javascript
exports.up = async function(knex) {
  await knex.schema.alterTable('users', function(table) {
    table.datetime('last_login_at').nullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('users', function(table) {
    table.dropColumn('last_login_at');
  });
};
```

But instead of letting knex run ALTER, you wire it to gh-ost in prod.

### Step 4: Run Online Schema Change (with gh-ost)

**Example command:**

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
  --switch-to-rbr \
  --chunk-size=1000 \
  --max-load=Threads_running=25 \
  --critical-load=Threads_running=100 \
  --execute
```

- `chunk-size` controls how many rows are copied per iteration (safe for production).
- Runs while traffic continues.
- At final cutover, old table renamed → new table swapped in (sub-second lock).

### Step 5: Validate Migration

- Compare row counts between old & new tables.
- Use checksum (`pt-table-checksum` or app-level verification).
- **Monitor:**
  - Replica lag (CloudWatch `ReplicaLag`).
  - Query performance.

### Step 6: Update Node.js Backend to Use Column

Once migration is complete:

**Update write paths to set column:**

```javascript
await db.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [userId]);
```

Deploy.

**Update read paths to select column, but keep fallback logic if NULL.**

### Step 7: Rollout Strategy

- Stage migration in lower environments first.
- **In prod:**
  - Deploy migration tool first.
  - Once complete, deploy app changes.
- **Use feature flags:**
  - Only enable usage of new column gradually.
  - Roll back flag if issues.

### Step 8: Rollback Plan

**If migration fails mid-way:**
- Stop gh-ost → old table untouched.
- No downtime.

**If app fails:**
- Rollback feature flag → ignore new column.

## 3. Real-Life Example: Adding last_login_at

**Before migration:**

```sql
SELECT id, email FROM users WHERE id = 123;
```

**During migration:**
- gh-ost copying rows in background.
- New table has `last_login_at` column, initially `NULL`.

**After migration:**

```sql
SELECT id, email, last_login_at FROM users WHERE id = 123;
```

**Node.js code (post-migration):**

```javascript
// Update last_login_at after login
await writerPool.query(
  "UPDATE users SET last_login_at = NOW() WHERE id = ?",
  [userId]
);

// Read user profile
const [rows] = await readerPool.query(
  "SELECT id, email, last_login_at FROM users WHERE id = ?",
  [userId]
);
```

## 4. Big-Tech Best Practices

- Never assume column exists → use migrations + feature flags.
- Avoid default values on massive tables (forces full table rewrite).
- Use online schema change tools (gh-ost, pt-online-schema-change).
- Test rollback strategy before prod.
- Monitor replication lag during migration.

## Summary

For adding a column to a 1B-row table in RDS MySQL with Node.js:

1. **Plan migration** (nullable column).
2. **Use gh-ost or pt-online-schema-change** for zero-downtime schema change.
3. **Prepare Node.js code** for backward-compatibility.
4. **Run migration gradually**.
5. **Deploy app updates** with feature flags.
6. **Validate and rollback** safely if needed.