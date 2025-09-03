# MySQL LIST Partitioning Guide

## What is LIST Partitioning?

* **LIST partitioning** assigns rows to partitions based on **discrete values** of a column.
* Unlike RANGE (ranges of values) or HASH (hash distribution), **LIST is for categorical data** (country, region, department, status, etc.).

👉 Use it when you have a **finite set of categories** and queries filter by those categories.

## Real-World Scenario: Multi-Region SaaS Platform

Suppose you run a **SaaS product** with customers across regions.

* Users are stored in a `users` table.
* Regions = `US`, `EU`, `APAC`.
* **Queries:**
   * "Show me all users in US."
   * "List EU customers with pending subscriptions."

👉 Partitioning by `region_code` (LIST) makes sense.

## Step 1: Create Partitioned Table

```sql
CREATE TABLE users (
  id BIGINT NOT NULL,
  name VARCHAR(100),
  email VARCHAR(100),
  region_code CHAR(3) NOT NULL,
  status ENUM('ACTIVE','PENDING','SUSPENDED'),
  PRIMARY KEY (id, region_code)
)
PARTITION BY LIST COLUMNS (region_code) (
  PARTITION pUS   VALUES IN ('US'),
  PARTITION pEU   VALUES IN ('FR','DE','UK','ES','IT'),
  PARTITION pAPAC VALUES IN ('IN','SG','AU','JP'),
  PARTITION pOTH  VALUES IN ('BR','ZA','MX')
);
```

**Explanation:**
* Partition key = `region_code`.
* Each region's data goes into its own partition.
* **Example:**
   * Users from `US` → `pUS`.
   * Users from `FR,DE,UK,ES,IT` → `pEU`.
   * Users from `IN,SG,AU,JP` → `pAPAC`.
   * Others → `pOTH`.

## Step 2: Querying

Example query:

```sql
EXPLAIN PARTITIONS
SELECT * FROM users WHERE region_code = 'US';
```

Output:

```
... partitions: pUS
```

👉 Only `pUS` partition is scanned (partition pruning).

If you query multiple regions:

```sql
SELECT * FROM users WHERE region_code IN ('US','IN');
```

👉 MySQL scans **pUS + pAPAC** only, not all partitions.

## Step 3: Insert Behavior

```sql
INSERT INTO users (id, name, email, region_code, status)
VALUES (1001, 'John Doe', 'john@doe.com', 'US', 'ACTIVE');
```

👉 MySQL places this row in **partition pUS**.

## Step 4: Benefits

### ✅ Advantages:
* Efficient for **categorical filtering** (region, department, product category).
* Smaller indexes per partition → faster lookups.
* Easy partition maintenance (e.g., move all EU data separately).

## Step 5: Limitations

### ❌ Drawbacks:
* Partitioning key (`region_code`) must be part of **primary key**.
* Not ideal if categories are **too many** or **constantly changing**.
* Queries without filtering on `region_code` will scan all partitions.
* Max 1024 partitions in MySQL.

## Step 6: Practical AWS RDS Use Case

Imagine an **analytics platform** storing **millions of users by region**:
* Reports are usually **region-specific**.
* You often run queries like "Get all APAC customers with PENDING status."

👉 Instead of scanning 100M+ users, MySQL will only scan **APAC partition** (~20M rows). This **reduces query time drastically**.

## Comparison with RANGE & HASH

* **RANGE** → best for **time-series (date-based)** data (logs, events).
* **HASH** → best for **even distribution** across partitions (user_id, tenant_id).
* **LIST** → best for **discrete categories** (region, department, product line).

## Summary

* **LIST partitioning** lets you store categorical data in separate partitions.
* Works well in SaaS/multi-region apps where queries are region-based.
* **Example:** `users` table partitioned by `region_code`.
* Huge win when queries filter by region → only relevant partitions scanned.