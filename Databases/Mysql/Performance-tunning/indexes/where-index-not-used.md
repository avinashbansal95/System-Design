# MySQL Index Usage Guide

## General Rule of Index Usage

Indexes are used when MySQL can **deterministically narrow down rows** using the indexed column.

They're **not used** when MySQL must evaluate row-by-row (because of functions, wildcards, OR misuse, etc.).

## 1. Operators Where Index **Works**

### ✅ Equality (`=`)

```sql
CREATE INDEX idx_email ON users(email);

SELECT * FROM users WHERE email = 'john@example.com';
```

👉 Index is used (type = `ref`).

### ✅ IN (with constants or indexed column)

```sql
SELECT * FROM users WHERE email IN ('a@x.com', 'b@x.com');
```

👉 Index is used (multiple equality lookups).

### ✅ Range Operators (`>`, `<`, `>=`, `<=`, `BETWEEN`)

```sql
CREATE INDEX idx_order_date ON orders(order_date);

SELECT * FROM orders WHERE order_date BETWEEN '2023-01-01' AND '2023-01-31';
```

👉 Index is used (`range` scan).

### ✅ LIKE (prefix search only)

```sql
CREATE INDEX idx_name ON users(name);

-- Uses index
SELECT * FROM users WHERE name LIKE 'John%';
```

👉 Index works because `'John%'` is **left-anchored** (prefix search).

### ✅ IS NULL / IS NOT NULL

```sql
CREATE INDEX idx_phone ON users(phone);

SELECT * FROM users WHERE phone IS NULL;
```

👉 Index is used.

## 2. Operators Where Index **Does NOT Work**

### ❌ Functions on Indexed Column

```sql
CREATE INDEX idx_order_date ON orders(order_date);

-- Index NOT used
SELECT * FROM orders WHERE YEAR(order_date) = 2023;
```

👉 MySQL must apply `YEAR()` to every row → can't use index.

**✅ Fix:**

```sql
SELECT * FROM orders 
WHERE order_date BETWEEN '2023-01-01' AND '2023-12-31';
```

### ❌ LIKE (leading wildcard)

```sql
-- Index NOT used
SELECT * FROM users WHERE name LIKE '%John';
SELECT * FROM users WHERE name LIKE '%John%';
```

👉 MySQL can't use index because it doesn't know the starting point (must scan all rows).

### ❌ Not Equal (`!=` or `<>`)

```sql
SELECT * FROM users WHERE email != 'john@example.com';
```

👉 Usually results in full scan, because MySQL must check *all other values*.

### ❌ OR (if columns differ)

```sql
-- Index NOT used
SELECT * FROM users WHERE email = 'a@x.com' OR phone = '12345';
```

👉 MySQL may ignore indexes and scan all rows.

**✅ Fix:** Use `UNION` with indexed queries:

```sql
SELECT * FROM users WHERE email = 'a@x.com'
UNION
SELECT * FROM users WHERE phone = '12345';
```

### ❌ Leading Wildcard with LIKE

Already mentioned, but critical: `LIKE '%abc'` → full scan.

**✅ Fix:** Use **FULLTEXT index** for substring search.

### ❌ Complex Expressions

```sql
-- Index NOT used
SELECT * FROM users WHERE id + 1 = 100;
```

👉 MySQL must compute `id+1` for every row.

**✅ Fix:**

```sql
SELECT * FROM users WHERE id = 99;
```

### ❌ Data Type Mismatch

```sql
CREATE INDEX idx_id ON users(id);

-- Index NOT used (string vs int mismatch)
SELECT * FROM users WHERE id = '100';
```

👉 MySQL might not use index if types differ (depends on optimizer).

**✅ Always match column type.**

## 3. Multi-Column Index Rules

If you have a **composite index** (`(col1, col2, col3)`):

* ✅ Works for queries filtering by **col1**.
* ✅ Works for queries filtering by **col1 + col2**.
* ✅ Works for queries filtering by **col1 + col2 + col3**.
* ❌ Does NOT work if you skip leading column (e.g., only `col2 = 'x'`).

👉 This is the **Leftmost Prefix Rule**.

**Example:**

```sql
CREATE INDEX idx_user_order ON orders(user_id, order_date);

-- Uses index
SELECT * FROM orders WHERE user_id = 10;

-- Uses index
SELECT * FROM orders WHERE user_id = 10 AND order_date = '2023-01-01';

-- ❌ Does NOT use index
SELECT * FROM orders WHERE order_date = '2023-01-01';
```

## 4. Using `EXPLAIN` to Verify

Always run:

```sql
EXPLAIN SELECT ...
```

**Check:**
* `key` → which index is used.
* `type` → `const`, `ref`, `range` are good. Avoid `ALL` (full scan).
* `rows` → should be low (not millions).

## Summary (Quick Cheat Sheet)

### ✅ Index **works** with:
* `=`, `IN`, `BETWEEN`, `<`, `>`, `<=`, `>=`
* `LIKE 'abc%'` (prefix only)
* `IS NULL`, `IS NOT NULL`
* Composite indexes (if leftmost column is used)

### ❌ Index **does not work** with:
* `!=` or `<>`
* `LIKE '%abc'` or `LIKE '%abc%'`
* Functions on indexed columns (`YEAR(col)`, `UPPER(col)`)
* Expressions (`col + 1 = 100`)
* OR (across different columns, unless optimizer chooses index merge)
* Skipping leftmost column in composite index