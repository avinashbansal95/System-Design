# MySQL HASH Partitioning Guide

## What is HASH Partitioning?

* Instead of ranges (like dates in RANGE partitioning), **HASH partitioning evenly distributes rows across N partitions** using a hash function on a column.
* Good when:
   * Data is not naturally sequential (like timestamps).
   * You want to spread writes/reads evenly across partitions.
   * Typical case = **large "hot" table** where queries filter by a high-cardinality key (like `user_id`).

## Real-World Scenario: Partitioning an `orders` Table

Suppose you run a **global e-commerce platform** on RDS MySQL.

* **Table:** `orders`
* **Columns:** `id`, `user_id`, `order_date`, `total`
* **Data size:** billions of rows.
* **Queries:**
   * "Fetch all orders of user X."
   * "Show user X's orders in last 6 months."

👉 Here, `user_id` is a perfect candidate for partitioning. Why?
* Every query filters on `user_id`.
* We want to distribute data evenly across partitions → avoid **one giant hot partition**.

## Step 1: Create Partitioned Table with HASH

```sql
CREATE TABLE orders (
  id BIGINT NOT NULL,
  user_id INT NOT NULL,
  order_date DATE NOT NULL,
  total DECIMAL(10,2),
  PRIMARY KEY (id, user_id)
)
PARTITION BY HASH(user_id)
PARTITIONS 8;
```

**Explanation:**
* Partitioning column = `user_id`.
* MySQL applies a **hash function** on `user_id`.
* Data spread across **8 partitions** (`p0, p1, ..., p7`).
* Each partition is stored separately.

## Step 2: Querying

Now, when you query:

```sql
EXPLAIN PARTITIONS
SELECT * FROM orders WHERE user_id = 12345;
```

Output:

```
... partitions: p5
```

👉 MySQL knows which partition to scan (`p5`), so it doesn't touch all partitions.

If your query doesn't filter by `user_id`, then **all partitions are scanned** (not efficient).

## Step 3: Insert Behavior

When inserting:

```sql
INSERT INTO orders (id, user_id, order_date, total)
VALUES (10001, 12345, '2023-08-01', 500.00);
```

👉 MySQL applies `hash(12345)` → decides partition → stores row there. So users are consistently routed to the same partition.

## Step 4: Scaling Example

Suppose each partition can handle ~100M rows comfortably.
* 8 partitions → 800M rows.
* If you grow beyond that, you can recreate the table with **16 partitions** and reload data.

⚠️ **Note:** MySQL doesn't support dynamic repartitioning (unlike Vitess sharding). You must **create a new table, partitioned differently, and migrate data**.

## Step 5: Benefits & Limitations

### ✅ Benefits:
* Queries filtering by `user_id` → fast (partition pruning).
* Writes spread evenly across partitions (better I/O).
* Each partition has smaller indexes → faster lookups.

### ❌ Limitations:
* Must include partition key (`user_id`) in **all unique/primary keys**.
* Can't use foreign keys.
* Partition count fixed → repartitioning requires rebuild.
* Queries without `user_id` filter scan all partitions (slower).

## Example: Why HASH Partitioning Helps

**Without partitioning:**

```sql
SELECT * FROM orders WHERE user_id = 12345;
```

👉 Scans **all 1B rows** (if `user_id` index missing or bloated).

**With HASH partitioning (8 partitions):**

👉 Scans only **1/8th of table (~125M rows)**, and usually much less since partitioning + index kicks in.

This **reduces query time drastically**.

## Comparison with RANGE Partitioning

* **RANGE**: Best for **time-series / logs** (drop old partitions).
* **HASH**: Best for **load distribution across partitions** when queries are by **user_id, tenant_id, etc.**.

## Summary

* In MySQL RDS, **HASH partitioning** is done with `PARTITION BY HASH(column) PARTITIONS n`.
* Great for **multi-tenant / user-centric tables** with billions of rows.
* Works best when queries filter on the **partition key** (`user_id`).
* Helps distribute load and reduce index size per partition.

---

*Would you like me to also show how **LIST partitioning** works (e.g., splitting `users` table by country/region → `US`, `EU`, `APAC` partitions)?*