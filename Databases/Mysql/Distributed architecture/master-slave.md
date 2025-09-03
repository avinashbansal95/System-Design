# MySQL Master-Slave Replication in AWS RDS Guide

## 1. What Does "Master–Slave" Mean in RDS?

In database terms, we now call it **primary–replica**.

### Primary (master):
- Handles writes (INSERT, UPDATE, DELETE).
- Has the authoritative copy of data.

### Replica (slave):
- Handles reads (SELECT).
- Gets updates from the primary asynchronously or semi-synchronously.

### Goal:
- Scale reads by offloading to replicas.
- Provide high availability (if master fails, promote replica).

## 2. Master–Slave in AWS RDS

AWS RDS supports replication in two main ways:

### (A) Multi-AZ (High Availability)
- Provides synchronous replication.
- AWS automatically creates a standby replica in another AZ.
- Writes go to both primary and standby synchronously.
- Standby is not used for reads (only for failover).

👉 Good for HA, not for scaling reads.

### (B) Read Replicas (Scalability)
- Provides asynchronous replication.
- You can create up to 15 read replicas.
- Replicas can be in the same region or cross-region.
- Replicas can be promoted to standalone DBs if needed.

👉 Good for read scaling and geo-distribution.

## 3. How Replication Works (MySQL/Postgres in RDS)

### For MySQL (RDS/Aurora MySQL)

Replication is based on binary logs (binlogs):

1. Primary writes changes to its binlog.
2. Replica reads the binlog stream over a replication channel.
3. Replica replays those changes locally.

**Types:**

- **Asynchronous (default):**
  - Replica eventually catches up.
  - There may be replica lag (seconds → minutes under load).

- **Semi-synchronous (Aurora option or RDS plugin):**
  - At least one replica acknowledges before commit succeeds.
  - Better durability, slightly higher latency.

### For PostgreSQL (RDS/Postgres)

Replication is based on WAL (Write Ahead Logs):

1. Primary writes to WAL.
2. WAL is shipped to replicas.
3. Replicas replay WAL for consistency.

**Modes:**

- **Asynchronous:** primary doesn't wait for replica acknowledgment.
- **Synchronous:** primary waits until WAL is received/applied by replica.

## 4. How to Enable Master–Slave (Replica) in RDS

### Step 1: Enable Binary Logging (MySQL/Postgres)

Required for replication.

In RDS → modify parameter group:
- `binlog_format = ROW`
- `binlog_row_image = FULL`

### Step 2: Create a Read Replica

In AWS Console:
1. Go to RDS → Databases → Select your DB.
2. Click Actions → Create Read Replica.
3. Choose same/different region.
4. Choose instance type, storage, etc.
5. Launch.

AWS will:
- Enable binlogs on primary.
- Create a replica instance.
- Start replication automatically.

### Step 3: Connect Applications

- Use primary endpoint for writes.
- Use replica endpoint for read-only queries.
- Some use ProxySQL / RDS Proxy to route queries automatically.

## 5. Sync Between Master and Slave (MySQL Flow)

Let's say you run:

```sql
INSERT INTO orders (id, user_id, total) VALUES (1001, 123, 500.00);
```

### On Primary:
1. Change written to InnoDB buffer pool.
2. Change recorded in binary log (binlog).
3. Binlog event sent to replicas.

### On Replica:
1. I/O thread reads binlog from master → writes to relay log.
2. SQL thread applies relay log → updates replica's InnoDB.
3. Replica now has the row.

⚠️ Delay between step 2 and 3 = replication lag.

## 6. Monitoring Replication

Use AWS RDS or SQL commands.

### For MySQL:

```sql
SHOW SLAVE STATUS\G
```

**Important fields:**
- `Seconds_Behind_Master` → replication lag.
- `Slave_IO_Running` → is I/O thread pulling binlogs?
- `Slave_SQL_Running` → is SQL thread applying logs?

### In RDS → use CloudWatch metrics:
- `ReplicaLag` (in seconds).

## 7. Handling Failover

- **Multi-AZ:** AWS automatically promotes standby to primary. Endpoint is updated transparently.
- **Read Replica:** You can manually promote a replica to primary (becomes standalone DB).

## Example: E-Commerce App on RDS MySQL

- Primary RDS MySQL handles all writes (orders, payments).
- Create 3 read replicas in different AZs for:
  - Analytics queries (reporting).
  - Search queries.
  - API read traffic.

### App routing:
- INSERT/UPDATE/DELETE → primary endpoint.
- SELECT (non-critical, high-volume) → replica endpoints.

### Result:
- Primary load reduced.
- Reads scale horizontally.
- Failover available via Multi-AZ + replica promotion.

## Summary

- **Master (primary)** → writes.
- **Slave (replica)** → reads.
- Sync via binlogs (MySQL) or WAL (Postgres).
- **In AWS RDS:**
  - Multi-AZ = synchronous HA.
  - Read Replicas = async read scaling.
  - Replication lag exists (except Aurora's storage-based model).