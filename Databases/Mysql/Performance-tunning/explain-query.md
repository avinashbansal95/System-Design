# MySQL EXPLAIN: Query Optimization Guide

## 🔹 1. The EXPLAIN Command

* `EXPLAIN <query>` (or `EXPLAIN ANALYZE` in MySQL 8.0+).
* Shows the execution plan MySQL will use for your query.
* Helps identify table scans, bad join orders, wrong index usage.

## 🔹 2. Example Schema

Suppose we have an e-commerce database:

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  INDEX(email)
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  order_date DATE,
  total DECIMAL(10,2),
  INDEX(user_id),
  INDEX(order_date)
);
```

* `users` has 1M rows.
* `orders` has 10M rows.

## 🔹 3. Example Queries & EXPLAIN

### Query 1: Find orders for a user by email

```sql
EXPLAIN SELECT o.id, o.total
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE u.email = 'john@example.com';
```

### Sample Output:

| id | select_type | table | type | possible_keys | key | rows | Extra |
|----|-------------|-------|------|---------------|-----|------|--------|
| 1 | SIMPLE | u | ref | PRIMARY,email | email | 1 | Using index |
| 1 | SIMPLE | o | ref | user_id | user_id | 10 | Using where |

## 🔹 4. Key Fields in EXPLAIN

### (A) table
* Which table is being read in that step.
* 👉 Example: `u` (users) first, then `o` (orders).

### (B) type (VERY IMPORTANT 🚨)
Access method → tells how efficient the lookup is.

Common values (best to worst):
* **system** → table has 1 row (fastest).
* **const** → lookup by primary key with constant (super fast).
* **eq_ref** → unique index lookup in a join (fast).
* **ref** → non-unique index lookup (still good).
* **range** → index range scan (BETWEEN, <, >).
* **index** → full index scan (better than table scan).
* **ALL** → full table scan (⚠️ BAD for big tables).

👉 In example:
* `u` is `ref` (using index on email).
* `o` is `ref` (using index on user_id).
✅ Both are good.

### (C) key
* Which index is actually used.
* 👉 Example: `email` index for users, `user_id` index for orders.
* If `NULL` → no index used (bad sign, means full table scan).

### (D) rows
* Estimated number of rows MySQL will scan.
* Smaller = better.

👉 In example:
* `users` scans 1 row (perfect).
* `orders` scans ~10 rows (fast).
* If you see `rows = 1M` → huge scan, probably missing an index.

### (E) Extra
Hints about extra operations:
* **Using index** → covered index (good, no extra table read).
* **Using where** → filtering applied.
* **Using temporary** → needs temp table (bad for perf).
* **Using filesort** → extra sort required (bad if large).

👉 In example:
* `Using index` on users → great (index-only lookup).
* `Using where` on orders → fine.

## 🔹 5. Example of a Bad Query

```sql
EXPLAIN SELECT * FROM orders WHERE total > 100;
```

### Output:
| id | select_type | table | type | possible_keys | key | rows | Extra |
|----|-------------|-------|------|---------------|-----|------|--------|
| 1 | SIMPLE | orders | ALL | NULL | NULL | 10M | Using where |

👉 **Interpretation**:
* `type = ALL` → full table scan.
* `rows = 10M` → scanning entire orders table.
* `key = NULL` → no index used.

✅ **Fix**: Add an index:

```sql
ALTER TABLE orders ADD INDEX idx_total (total);
```

Re-run EXPLAIN, now it should say `range` with `key = idx_total`.

## 🔹 6. Profiling Query Performance

In MySQL 8.0: use `EXPLAIN ANALYZE` instead of plain `EXPLAIN`.

```sql
EXPLAIN ANALYZE SELECT o.id, o.total
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE u.email = 'john@example.com';
```

👉 This not only shows the plan, but also actual execution time per step.

### Sample:

```
-> Nested loop inner join  (cost=11.20 rows=10) (actual time=0.1..1.2 rows=10 loops=1)
    -> Index lookup on users.email (cost=2.20 rows=1) (actual time=0.02..0.03 rows=1 loops=1)
    -> Index lookup on orders.user_id (cost=9.00 rows=10) (actual time=0.5..1.0 rows=10 loops=1)
```

* **cost** = optimizer estimate.
* **actual time** = real execution.
* If actual >> cost, optimizer misjudged → maybe missing stats or wrong index.

## 🔹 7. Checklist: What to Look At

* **type**: Avoid `ALL`, aim for `ref`, `eq_ref`, `const`.
* **key**: Ensure correct index is used (not `NULL`).
* **rows**: Must be as small as possible (avoid millions).
* **Extra**: Avoid `Using temporary` and `Using filesort` on large datasets.
* **EXPLAIN ANALYZE**: Compare cost vs actual time.

## ✅ Summary

* Use `EXPLAIN` to see what MySQL plans to do.
* Focus on `type`, `key`, `rows`, and `Extra`.
* Use `EXPLAIN ANALYZE` (MySQL 8.0) to see what actually happened.
* Optimize with indexes, query rewrites, join order, avoiding temp tables/filesorts.