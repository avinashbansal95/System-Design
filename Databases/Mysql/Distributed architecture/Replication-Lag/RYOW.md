# Read Your Own Writes (RYOW) Consistency Guide

## 1. What is RYOW Consistency?

* **Problem:** In master–slave (async) replication, writes go to the **primary**, but reads often go to **replicas**.
* If replica is lagging → user reads stale data.
* **RYOW solution:** Ensure that *a user's reads right after their writes* are routed to the **primary** (or a fresh replica).

## 2. Real-Life Example: E-Commerce "Orders"

**Scenario:**
* User places an order (`INSERT INTO orders`).
* Immediately checks "My Orders" (`SELECT * FROM orders WHERE user_id=?`).
* If read goes to a replica with lag → order not visible → **bad UX**.

**We want:**
* The user who just wrote data must see it **immediately**.
* Later reads can still go to replicas (for scalability).

## 3. Strategy to Implement RYOW

There are 3 common approaches:

### Option A: Route to Primary after Write
* After a user writes → subsequent reads go to **primary** for a short period (session-based).

### Option B: Lag-Aware Routing
* Check replica lag (`SHOW SLAVE STATUS` or CloudWatch in RDS).
* If lag > threshold → read from primary.

### Option C: Token-based Consistency (Last Seen Binlog/GTID)
* After a write, record the **binlog position** (GTID).
* Ensure reads happen from a replica that has applied at least up to that GTID.
* More complex, common in large-scale infra (e.g., Facebook, Uber).

For **Node.js + MySQL RDS**, Option A is the most straightforward.



# Node.js RYOW Implementation with Redis and MySQL

## 1. Setup: Redis + MySQL Pools

```javascript
import mysql from "mysql2/promise";
import Redis from "ioredis";

// Primary (writer)
const writerPool = mysql.createPool({
  host: "my-primary-db.rds.amazonaws.com",
  user: "admin",
  password: "password",
  database: "ecommerce"
});

// Replica (reader)
const readerPool = mysql.createPool({
  host: "my-replica-db.rds.amazonaws.com",
  user: "admin",
  password: "password",
  database: "ecommerce"
});

// Redis (for per-user stickiness)
const redis = new Redis({
  host: "my-redis.cluster.amazonaws.com",
  port: 6379
});
```

## 2. Helper Functions

### Mark user after write (stick to primary for N seconds)

```javascript
async function afterWrite(userId, ttlSeconds = 2) {
  await redis.set(`forcePrimary:${userId}`, "1", "EX", ttlSeconds);
}
```

### Check if user should read from primary

```javascript
async function shouldReadFromPrimary(userId) {
  const val = await redis.get(`forcePrimary:${userId}`);
  return val !== null;
}
```

## 3. Query Functions

### Write (always goes to primary)

```javascript
async function writeOrder(userId, total) {
  const [result] = await writerPool.query(
    "INSERT INTO orders (user_id, total, created_at) VALUES (?, ?, NOW())",
    [userId, total]
  );

  // Mark this user to force reads from primary
  await afterWrite(userId);

  return result.insertId;
}
```

### Read (decide pool based on Redis flag)

```javascript
async function readOrders(userId) {
  const usePrimary = await shouldReadFromPrimary(userId);
  const pool = usePrimary ? writerPool : readerPool;

  const [rows] = await pool.query(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );

  return rows;
}
```

## 4. Usage Example

```javascript
async function demo() {
  const userId = 101;

  // Step 1: User places an order
  const orderId = await writeOrder(userId, 499.99);
  console.log("Order placed:", orderId);

  // Step 2: Immediately fetch "My Orders"
  const ordersNow = await readOrders(userId);
  console.log("Orders right after placing:", ordersNow);

  // Step 3: After a few seconds, reads go back to replica
  setTimeout(async () => {
    const ordersLater = await readOrders(userId);
    console.log("Orders later (replica):", ordersLater);
  }, 5000);
}

demo();
```

## 5. How It Works

1. **User 101 places order** → goes to primary DB.
2. `afterWrite(101)` sets Redis key:

```
forcePrimary:101 = "1" (expires in 2s)
```

3. Immediate **read by user 101** → `shouldReadFromPrimary(101) === true` → query routed to primary.
4. **User 202 reads** → no Redis flag → query routed to replica.
5. After 2s TTL expires → User 101's reads also go to replicas (lag tolerated).

This ensures **only the user who just wrote gets strong consistency**, while others continue using replicas for scalability.

## 6. Real-World Enhancements

* Use **JWT userId** or **sessionId** as the Redis key.
* Adjust TTL dynamically based on **replication lag** (e.g., from CloudWatch `ReplicaLag` in RDS).
* Wrap this logic into a **DB client/middleware** so app code doesn't need to handle pool selection manually.

## Summary

* We solved the global flag problem by using **Redis keys per user**.
* This works across multiple Node.js servers in a distributed system.
* Flow: **Write → Redis flag → Read from primary → Expire → Back to replicas**.