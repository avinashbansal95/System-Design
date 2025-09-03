# Application-level Sharding (Direct, Manual)

## Approach 1: Application-level Sharding (Direct, Manual)

This is the **most common first step** because it's simple to implement and doesn't require extra infra beyond multiple RDS clusters.

## How it works:

* You run multiple **RDS MySQL instances** (or Aurora clusters).
* You decide **shard key** (e.g., `user_id`, `tenant_id`, `region`).
* You keep a **Shard Map** (metadata about which shard stores which keys).
  * Could be stored in Redis, DynamoDB, or a config service.
* Your app (Node.js) routes queries to the right RDS instance.

## Example: Node.js Implementation

```javascript
// Example: user sharding by user_id % 4
const mysql = require("mysql2/promise");

const shards = {
  0: mysql.createPool({ host: "rds-shard-0.us-east-1.rds.amazonaws.com", user: "admin", password: "xxx", database: "app_db" }),
  1: mysql.createPool({ host: "rds-shard-1.us-east-1.rds.amazonaws.com", user: "admin", password: "xxx", database: "app_db" }),
  2: mysql.createPool({ host: "rds-shard-2.us-east-1.rds.amazonaws.com", user: "admin", password: "xxx", database: "app_db" }),
  3: mysql.createPool({ host: "rds-shard-3.us-east-1.rds.amazonaws.com", user: "admin", password: "xxx", database: "app_db" }),
};

function getShard(userId) {
  return shards[userId % 4]; // modulus-based sharding
}

async function getUser(userId) {
  const shard = getShard(userId);
  const [rows] = await shard.query("SELECT * FROM users WHERE id = ?", [userId]);
  return rows[0];
}
```

## ✅ **Pros**:
* Simple, predictable.
* Scales horizontally by adding more RDS instances.
* Easy to implement in Node.js with connection pools.

## ❌ **Cons**:
* Hard to do **cross-shard queries** (joins, aggregations).
* **Resharding** (moving data when shard count changes) is complex.
* Your app logic gets "shard-aware."

## ⚡ Used by: 
**Airbnb, Uber (early), Slack, Pinterest** before moving to middleware solutions.