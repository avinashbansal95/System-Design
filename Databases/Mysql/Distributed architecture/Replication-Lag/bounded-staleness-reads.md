# Bounded Staleness Implementation in Node.js

## 1. Concept Recap

* **Problem:** Replicas are async → can lag.
* **Bounded staleness approach:**
   * Use replica **only if its lag ≤ threshold (X seconds)**.
   * Otherwise, read from primary to guarantee freshness.

## 2. How to Get Replica Lag in AWS RDS

### Option A: From MySQL/Postgres directly

**In MySQL replica:**

```sql
SHOW SLAVE STATUS\G
```

Look at:
* `Seconds_Behind_Master` (how many seconds replica lags).

**In Postgres replica:**

```sql
SELECT EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())::INT AS replica_lag;
```

### Option B: From AWS CloudWatch (preferred in production)

* RDS exposes `ReplicaLag` metric.
* You can query CloudWatch API to get the lag for each replica.

## 3. Node.js Implementation

We'll show **Option A (SQL-based)** since it's easiest to demo, and then note Option B (CloudWatch API).

### Step 1: Setup MySQL Pools

```javascript
import mysql from "mysql2/promise";

// Primary DB (writer)
const writerPool = mysql.createPool({
  host: "my-primary-db.rds.amazonaws.com",
  user: "admin",
  password: "password",
  database: "ecommerce"
});

// Replica DB (reader)
const readerPool = mysql.createPool({
  host: "my-replica-db.rds.amazonaws.com",
  user: "admin",
  password: "password",
  database: "ecommerce"
});
```

### Step 2: Function to Get Replica Lag

```javascript
async function getReplicaLag() {
  const [rows] = await readerPool.query("SHOW SLAVE STATUS");
  if (rows.length === 0) return Infinity; // not a replica

  return rows[0].Seconds_Behind_Master || 0;
}
```

### Step 3: Read Function with Bounded Staleness

```javascript
async function boundedRead(userId, maxLagSeconds = 2) {
  const lag = await getReplicaLag();

  const usePrimary = lag > maxLagSeconds;

  const pool = usePrimary ? writerPool : readerPool;

  console.log(
    `Replica lag = ${lag}s → Reading from ${usePrimary ? "PRIMARY" : "REPLICA"}`
  );

  const [rows] = await pool.query(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );

  return rows;
}
```

### Step 4: Example Usage

```javascript
async function demo() {
  const userId = 101;

  // Try bounded staleness read
  const orders = await boundedRead(userId, 3); // 3s max lag allowed
  console.log("Orders:", orders);
}

demo();
```

## 4. Using AWS CloudWatch (Production-Ready)

Instead of `SHOW SLAVE STATUS`, use AWS SDK to fetch `ReplicaLag` from CloudWatch.

```javascript
import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";

const cloudwatch = new CloudWatchClient({ region: "us-east-1" });

async function getReplicaLagFromCloudWatch(dbInstanceId) {
  const command = new GetMetricStatisticsCommand({
    Namespace: "AWS/RDS",
    MetricName: "ReplicaLag",
    Dimensions: [{ Name: "DBInstanceIdentifier", Value: dbInstanceId }],
    StartTime: new Date(Date.now() - 60 * 1000),
    EndTime: new Date(),
    Period: 60,
    Statistics: ["Average"]
  });

  const data = await cloudwatch.send(command);

  if (!data.Datapoints || data.Datapoints.length === 0) return Infinity;

  return data.Datapoints[0].Average;
}
```

Replace `getReplicaLag()` with this call to make routing decisions without hitting replica directly.

## 5. Real-Life Use Cases

### E-commerce analytics dashboard
* Querying sales reports.
* Okay if data is **2–3 seconds stale**.
* Set `maxLagSeconds = 3`.

### Banking app transaction history
* Cannot tolerate lag.
* Always set `maxLagSeconds = 0` → route to primary.

## 6. Summary

* **Bounded staleness = balance between performance & consistency.**
* Implementation in Node.js + RDS:
   * Get replica lag (`SHOW SLAVE STATUS` or CloudWatch metric).
   * If lag ≤ threshold → read from replica.
   * Else → read from primary.