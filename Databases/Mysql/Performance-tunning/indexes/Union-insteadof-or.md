# MySQL OR vs UNION EXPLAIN Comparison

Perfect 🚀 — let's do a **side-by-side comparison** of `OR` vs `UNION` using `EXPLAIN`. This is a classic MySQL tuning trick.

We'll stick to your `users` table example with indexes on `email` and `phone`.

## Setup

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255),
  phone VARCHAR(20),
  INDEX idx_email (email),
  INDEX idx_phone (phone)
);
```

## Query 1: Using `OR`

```sql
EXPLAIN SELECT * 
FROM users 
WHERE email = 'a@x.com' OR phone = '12345';
```

**Possible `EXPLAIN` output (small dataset, selective filters):**

| id | select_type | table | type | possible_keys | key | rows | Extra |
|----|-------------|-------|------|---------------|-----|------|-------|
| 1 | SIMPLE | users | index_merge | idx_email, idx_phone | idx_email, idx_phone | 3 | Using union(idx_email, idx_phone); Using where |

👉 MySQL uses **index merge** (union of both indexes).
* Works well if both conditions are **highly selective** (few rows returned).

### When Dataset Grows (millions of rows, one condition broad):

If `phone = '12345'` matches **100k rows** while `email` matches 1 row:

MySQL may decide index merge is too expensive and switch to **full table scan**:

| id | select_type | table | type | possible_keys | key | rows | Extra |
|----|-------------|-------|------|---------------|-----|------|-------|
| 1 | SIMPLE | users | ALL | idx_email, idx_phone | NULL | 1000000 | Using where |

👉 ⚠️ Full scan = performance disaster on large tables.

## Query 2: Using `UNION`

```sql
EXPLAIN
SELECT * FROM users WHERE email = 'a@x.com'
UNION
SELECT * FROM users WHERE phone = '12345';
```

**`EXPLAIN` output (stable regardless of dataset size):**

| id | select_type | table | type | possible_keys | key | rows | Extra |
|----|-------------|-------|------|---------------|-----|------|-------|
| 1 | PRIMARY | users | ref | idx_email | idx_email | 1 | Using where |
| 2 | UNION | users | ref | idx_phone | idx_phone | 1000 | Using where |

👉 MySQL runs **two index lookups**:
1. First query uses `idx_email`.
2. Second query uses `idx_phone`.
3. Results merged via UNION.

✅ Predictable. ✅ Always uses indexes. ✅ Avoids falling back to full scan.

## Side-by-Side Summary

| Query | Plan (small dataset) | Plan (large dataset, skewed data) | Predictability |
|-------|---------------------|-----------------------------------|----------------|
| `OR` | `index_merge` (good) | May switch to **full table scan** | ❌ Unreliable |
| `UNION` | Two index lookups | Still two index lookups | ✅ Reliable |

## Takeaway

* `OR` with indexed columns **can** use index merge → good for small or balanced datasets.
* But on large/skewed datasets → optimizer may switch to **full scan** (performance degrades).
* `UNION` forces MySQL to use **separate indexes** for each condition → predictable and scalable.