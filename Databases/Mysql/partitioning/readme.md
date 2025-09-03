# MySQL Partitioning Guide for AWS RDS

## What is Partitioning?

**Partitioning** = splitting a large table into smaller, more manageable pieces (partitions) while still presenting it as a single logical table.

- MySQL decides which partition to read/write using a partitioning key (column or expression)
- Each partition is stored separately in MySQL's storage layer
- Queries that filter on the partitioning key can skip irrelevant partitions (partition pruning) → huge performance win

## When Do You Need Partitioning?

### ✅ Use partitioning when:

- Table is very large (hundreds of millions / billions of rows)
- Queries are always filtered on a natural partitioning column (e.g., date, region, tenant_id)
- You need to drop old data fast (e.g., time-series / logs)
- You want to parallelize queries across partitions

### ❌ Don't use partitioning if:

- Your queries rarely filter by the partition key
- You think it's a replacement for sharding → it's not (partitioning is inside a single DB instance, sharding is across multiple)

## Partitioning Types in MySQL

MySQL supports 4 strategies:

- **RANGE** → based on ranges of values
- **LIST** → based on discrete values
- **HASH** → distributes rows by a hash function
- **KEY** → like HASH but MySQL's internal hash

## Practical Scenario (AWS RDS MySQL)

Let's say you're building a log analytics platform (like CloudWatch but smaller).

**Table:** `logs`

**Columns:** `id`, `timestamp`, `service_name`, `level`, `message`

**Data size:** billions of rows, new logs every second

**Queries:**
- "Get all logs from January 2023"
- "Delete all logs older than 6 months"

👉 Perfect use case for **RANGE partitioning** on timestamp.

## Step 1: Enable Partitioning in RDS

Partitioning works on InnoDB and NDB storage engines in MySQL 8.0+.

On AWS RDS:
- No special config needed
- Just ensure the engine supports partitioning (InnoDB does)

## Step 2: Create Partitioned Table

Example: Monthly partitions for logs.

```sql
CREATE TABLE logs (
  id BIGINT AUTO_INCREMENT,
  timestamp DATE NOT NULL,
  service_name VARCHAR(100),
  level ENUM('INFO','WARN','ERROR'),
  message TEXT,
  PRIMARY KEY (id, timestamp)
)
PARTITION BY RANGE (YEAR(timestamp)*100 + MONTH(timestamp)) (
  PARTITION p202301 VALUES LESS THAN (202302),
  PARTITION p202302 VALUES LESS THAN (202303),
  PARTITION p202303 VALUES LESS THAN (202304),
  PARTITION pmax     VALUES LESS THAN MAXVALUE
);
```

### Explanation:

- **Partition key:** `YEAR(timestamp)*100 + MONTH(timestamp)`
- Partitioned by month
- Data for Jan 2023 → p202301, Feb 2023 → p202302, etc.
- Future dates fall into pmax

## Step 3: Querying Partitioned Table

Example query:

```sql
EXPLAIN SELECT * FROM logs 
WHERE timestamp BETWEEN '2023-01-01' AND '2023-01-31';
```

👉 MySQL only scans `p202301`, not the whole table (partition pruning).

## Step 4: Managing Partitions

### Dropping old partitions

When March 2023 data is no longer needed:

```sql
ALTER TABLE logs DROP PARTITION p202303;
```

👉 Drops the entire partition instantly (no row-by-row delete).

### Adding new partitions

When April 2023 starts:

```sql
ALTER TABLE logs ADD PARTITION (
  PARTITION p202304 VALUES LESS THAN (202305)
);
```

## Step 5: Monitoring & Performance

- Query performance improves since only relevant partitions are scanned
- Maintenance is easy: drop old partitions instead of deleting millions of rows
- Use `EXPLAIN PARTITIONS` to see which partitions are being read

Example:

```sql
EXPLAIN PARTITIONS SELECT * FROM logs WHERE timestamp='2023-01-15';
```

Output:
```
... partitions: p202301
```

✅ Only one partition scanned.

## Step 6: Limitations (Important in AWS RDS)

- Max 1024 partitions
- Partition key must be part of all unique/primary keys
- No foreign keys on partitioned tables
- Global secondary indexes not supported (each partition has its own local index)

## Summary

**Partitioning in MySQL (RDS)** = splitting a large table into multiple partitions inside a single instance.

- **Best for:** time-series, logs, historical data
- **RANGE partitioning** (by date) is most common
- **Benefits:** partition pruning (faster queries), easy partition drop (fast deletes)
- **Limitations:** index + FK restrictions, max partitions

### ✅ Real-world AWS RDS case:

If you're storing billions of log entries, partition by date. Queries for "last 7 days" will only touch a few partitions instead of scanning billions of rows. Dropping old data = `ALTER TABLE DROP PARTITION` → instant cleanup.