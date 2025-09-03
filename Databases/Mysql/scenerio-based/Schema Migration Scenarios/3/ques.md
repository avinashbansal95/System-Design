# Safe Column Type Changes in Production: INT to BIGINT Migration

"You want to change a column type (e.g., INT → BIGINT) in a critical orders table with billions of rows. How do you do this safely in production with Node.js backend (Kubernetes, RDS MySQL)?"

This is one of the riskiest migrations in distributed systems, because:

- It's a destructive operation (modifies existing data format).
- On large tables, `ALTER TABLE` can lock or rewrite the table → hours of downtime.
- All services depending on that column must stay compatible.

## 🔹 1. Challenges

`ALTER TABLE orders MODIFY COLUMN order_id BIGINT` would:

- Lock the table.
- Rewrite all rows (billions).
- Cause replicas to lag heavily.
- Applications may assume type = INT (ORMs, validations, JSON contracts).
- If your system is sharded → each shard needs consistent migration.

👉 Must use **expand → migrate → contract** to stay safe.

## 🔹 2. Expand → Migrate → Contract Approach

### ✅ Step 1: Expand (Add New Column with Desired Type)

Add a new column (`order_id_bigint`) alongside the old one:

```bash
gh-ost \
  --host=my-primary-db.rds.amazonaws.com \
  --database=myapp \
  --table=orders \
  --alter="ADD COLUMN order_id_bigint BIGINT NULL" \
  --execute
```

👉 This is non-breaking because old `order_id` still exists.

### ✅ Step 2: Backfill Existing Data

Copy existing `order_id` into new `order_id_bigint`:

```sql
UPDATE orders SET order_id_bigint = order_id WHERE order_id_bigint IS NULL;
```

⚠️ For billions of rows → do it in chunks to avoid replica lag:

```sql
UPDATE orders SET order_id_bigint = order_id
WHERE id BETWEEN 1 AND 1000000;
```

Or better: use a background batch job in Node.js / Kafka stream processor to gradually backfill.

### ✅ Step 3: Dual-Write in Application (Node.js)

Update the backend so that new writes go into both columns.

```javascript
// When inserting a new order
await writerPool.query(
  "INSERT INTO orders (order_id, order_id_bigint, user_id, total) VALUES (?, ?, ?, ?)",
  [orderId, orderId, userId, total]
);

// When updating order_id
await writerPool.query(
  "UPDATE orders SET order_id = ?, order_id_bigint = ? WHERE id = ?",
  [newOrderId, newOrderId, id]
);
```

👉 This ensures both columns are always in sync for all new data.

### ✅ Step 4: Read from New Column with Fallback

Start reading from `order_id_bigint`, but keep fallback to `order_id` in case of nulls (during backfill).

```javascript
const [rows] = await readerPool.query(
  "SELECT id, COALESCE(order_id_bigint, order_id) AS order_id, user_id, total FROM orders WHERE id = ?",
  [id]
);
```

👉 Now your app is migrating at runtime without breaking old assumptions.

### ✅ Step 5: Verification

Check row counts:

```sql
SELECT COUNT(*) FROM orders WHERE order_id_bigint IS NULL;
```

→ should be 0.

Check consistency:

```sql
SELECT COUNT(*) FROM orders WHERE order_id != order_id_bigint;
```

→ should be 0.

### ✅ Step 6: Contract (Drop Old Column)

Once you are confident:
- All services use `order_id_bigint`.
- Data is consistent.

👉 Safely drop old column:

```bash
gh-ost \
  --alter="DROP COLUMN order_id" \
  --database=myapp \
  --table=orders \
  --execute
```

👉 Optionally:

```sql
ALTER TABLE orders CHANGE COLUMN order_id_bigint order_id BIGINT NOT NULL;
```

(renames new column back to original name).

## 🔹 3. Kubernetes Deployment Strategy

### First deploy:
- App code ignores new column.
- Run `gh-ost` to add `order_id_bigint`.

### Second deploy:
- App dual-writes (`order_id` + `order_id_bigint`).
- Reads from `order_id_bigint` with fallback.

### Background job:
- Backfill old rows gradually.
- Validate consistency.

### Final deploy:
- Remove dual-write logic.
- Drop old `order_id`.
- Rename `order_id_bigint` → `order_id`.

👉 Each deploy is rolling update in Kubernetes → zero downtime.

## 🔹 4. Real-World Example (Big Tech)

**Twitter** migrated `tweet_id` from INT → BIGINT because of scale.

They followed same pattern:
1. Introduced new column (`tweet_id_64`).
2. Dual-wrote for months.
3. Once confident → deprecated old column.

## 🔹 5. Best Practices

- **Never do a direct column type change** on large tables.
- **Always use shadow column + dual write**.
- **Backfill data incrementally**.
- **Keep dual-write for a safe period** (days/weeks).
- **Drop old column only after thorough validation**.
- **Always have a rollback plan** (if new column is wrong, fall back to old one).

## ✅ Summary

Changing column type (INT → BIGINT) in production with billions of rows:

1. **Add new column** with target type (Expand).
2. **Backfill old data** gradually.
3. **Dual-write in Node.js** (keep old + new in sync).
4. **Read from new** with fallback.
5. **Verify**.
6. **Drop old column, rename new** (Contract).