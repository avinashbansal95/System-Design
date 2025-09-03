# How ALTER Queries Cause Replication Lag in AWS RDS

## What is Replication Lag?

**Replication lag** = the time difference between when a change is committed on the master and when it's applied on the replica.

- **Master:** Executes the query → commits → logs to binlog
- **Replica:** Reads binlog → applies change → catches up
- **Lag:** Time between master commit and replica applying the change

## Why ALTER Queries Cause Severe Replication Lag

### 1. ALTER Operations are Blocking

```sql
-- This query can take hours on large tables
ALTER TABLE users ADD COLUMN phone VARCHAR(15);
```

**What happens:**

**On Master:**
- ALTER starts executing
- Table gets locked (depending on MySQL version/engine)
- Operation takes time proportional to table size
- Commits when complete
- Entire ALTER operation logged to binlog as one event

**On Replica:**
- Receives the binlog event
- Must replay the ENTIRE ALTER operation
- Single-threaded execution (in most cases)
- Blocks all other replication until ALTER completes

### 2. Size Matters

| Table Size | ALTER Duration | Replication Impact |
|------------|----------------|-------------------|
| 1M rows | ~30 seconds | 30+ second lag |
| 10M rows | ~5 minutes | 5+ minute lag |
| 100M rows | ~1 hour | 1+ hour lag |
| 1B rows | ~6 hours | 6+ hour lag |

### 3. Real Production Scenario

```sql
-- Production table with 500M rows
ALTER TABLE orders ADD INDEX idx_created_at (created_at);
```

**Timeline:**
- **T+0:** ALTER starts on master
- **T+45min:** ALTER completes on master, normal operations resume
- **T+45min:** Binlog event reaches replica
- **T+45min to T+90min:** Replica executes ALTER (blocked)
- **T+90min:** Replica catches up, 45min of lag accumulated

During those 45 minutes:
- All other changes queue up behind the ALTER
- Read replicas serve stale data
- Applications may timeout or fail

## Types of ALTER Operations and Their Impact

### High Impact (Causes Major Lag)

```sql
-- Table rebuilds - very expensive
ALTER TABLE users ADD COLUMN age INT;
ALTER TABLE users DROP COLUMN old_field;
ALTER TABLE users MODIFY COLUMN name VARCHAR(200);

-- Index creation on large tables
ALTER TABLE orders ADD INDEX idx_user_date (user_id, created_at);

-- Data type changes
ALTER TABLE products MODIFY price DECIMAL(10,2);
```

### Medium Impact

```sql
-- Adding indexes with ALGORITHM=INPLACE (MySQL 5.6+)
ALTER TABLE users ADD INDEX idx_email (email), ALGORITHM=INPLACE;

-- Dropping indexes (usually fast)
ALTER TABLE users DROP INDEX idx_old;
```

### Low Impact

```sql
-- Metadata-only changes
ALTER TABLE users RENAME TO customers;
ALTER TABLE users AUTO_INCREMENT = 1000;
```

## Monitoring Replication Lag During ALTER

### 1. Check Replica Lag in Real-Time

```sql
-- On replica
SHOW SLAVE STATUS\G
```

Look for:
- `Seconds_Behind_Master`: Current lag in seconds
- `Slave_SQL_Running_State`: Shows if ALTER is running

### 2. AWS CloudWatch Metrics

Monitor `ReplicaLag` metric for your RDS read replicas:
- Normal lag: < 1 second
- During ALTER: Can spike to hours

### 3. Check What's Running on Replica

```sql
-- See current queries
SHOW PROCESSLIST;

-- Check replication status
SHOW SLAVE STATUS\G
```

## Strategies to Minimize ALTER-Induced Lag

### 1. Use Online DDL (MySQL 5.6+)

```sql
-- Specify INPLACE algorithm to avoid table rebuilds
ALTER TABLE users 
ADD COLUMN phone VARCHAR(15), 
ALGORITHM=INPLACE, LOCK=NONE;
```

### 2. Use pt-online-schema-change (Percona Toolkit)

```bash
# Creates shadow table, copies data in chunks
pt-online-schema-change \
  --alter "ADD COLUMN phone VARCHAR(15)" \
  --execute h=mydb.amazonaws.com,D=mydb,t=users
```

### 3. Schedule During Low Traffic

- Run ALTER during maintenance windows
- Monitor application metrics during execution

### 4. Use Multiple Smaller Changes

Instead of:
```sql
ALTER TABLE users 
ADD COLUMN phone VARCHAR(15),
ADD COLUMN age INT,
ADD INDEX idx_phone (phone);
```

Do:
```sql
-- Spread across multiple maintenance windows
ALTER TABLE users ADD COLUMN phone VARCHAR(15);
-- Wait for replication to catch up
ALTER TABLE users ADD COLUMN age INT;
-- Wait for replication to catch up  
ALTER TABLE users ADD INDEX idx_phone (phone);
```

## What to Expect in Production

### Before ALTER
```
Master: ✅ Normal operations
Replica: ✅ Lag < 1 second
Application: ✅ Fast reads from replica
```

### During ALTER (on large table)
```
Master: ✅ ALTER completes in 30 minutes, then normal
Replica: ❌ Processing ALTER, lag growing
Application: ❌ Reading stale data from replica
```

### After ALTER
```
Master: ✅ Normal operations
Replica: ✅ Eventually catches up (may take as long as ALTER took)
Application: ✅ Fresh data available
```

## Key Takeaways

1. **ALTER operations cause replication lag** because replicas must replay the entire operation
2. **Lag duration ≈ time it takes to run ALTER** on the replica
3. **Large tables = severe lag** (hours possible)
4. **Plan accordingly:** Use maintenance windows, monitor lag, inform stakeholders
5. **Consider alternatives:** Online DDL, pt-online-schema-change, or staged deployments