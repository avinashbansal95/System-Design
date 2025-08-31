# 📌 How to Choose a Perfect Shard Key

A **shard key** decides:
* How documents are **distributed** across shards.
* How efficiently queries can target specific shards (vs scatter-gather).
* Whether writes will be evenly balanced (or hotspot on one shard).

## ✅ Rule #1: **High Cardinality**
* Shard key should have **many possible values**, not just a few.
* Ensures data can be spread evenly across shards.

### ❌ Bad Example
`status: "active" | "inactive"` → only 2 values → all active docs end up on one shard, inactive on another → imbalance.

### ✅ Good Example
`userId` with millions of unique users → spreads evenly.

## ✅ Rule #2: **Even Distribution of Writes**
* Shard key should avoid **monotonic growth** (like timestamps or ObjectIds with increasing prefix).
* Otherwise → all inserts go to the **last chunk** → hotspot on one shard.

### ❌ Bad Example
`createdAt` (timestamps) → all new writes go to latest chunk → one shard overloaded.

### ✅ Good Example
`hashed(userId)` → inserts randomly distributed across shards.

## ✅ Rule #3: **Support Query Patterns**
* Shard key should align with **most frequent query filters**.
* Otherwise queries will **scatter-gather** across all shards.

### ❌ Bad Example
Shard on `email`, but 90% of queries filter by `createdAt`. → All queries hit all shards.

### ✅ Good Example
Shard on `regionId` if most queries are like:

```javascript
db.orders.find({ regionId: "us-east" })
```

👉 Queries only touch 1 shard.

## ✅ Rule #4: **Write & Read Locality**
* In some cases, you want documents with a relationship to live on the **same shard**.
* Example: All orders of a user → shard by `userId`.

### Example
If Alice's orders live in Shard A, every query for Alice's orders stays local to Shard A → efficient.

## ✅ Rule #5: **Compound Shard Keys (when needed)**
Sometimes you need more than 1 field.

### Example: E-commerce Orders
* Queries are usually by `{ userId, createdAt }`.
* If you shard only by `userId` → good distribution, but range queries on `createdAt` are scatter-gather.
* If you shard only by `createdAt` → write hotspot (latest orders).
* ✅ **Best choice:** compound key `{ userId, createdAt }`
   * Distributes by user.
   * Within each user, orders are grouped by time.

## ✅ Rule #6: **Consider Zones (Tag Aware Sharding)**
* If you have **geo-specific queries**, choose shard key that maps to location.

### Example: Social App
* Shard by `{ regionId, userId }`.
* Put `regionId = "EU"` chunks in European datacenter shards, `regionId = "US"` chunks in US shards. 

👉 Local queries stay local.

## ⚡ Scenarios & Examples

### 🏦 Banking App (Transactions)
* **Bad shard key:** `transactionDate` → hotspot on latest shard.
* **Good shard key:** `accountId` → each account's transactions on one shard, evenly spread.

### 📦 E-commerce Orders
* **Bad shard key:** `productId` → popular products (e.g., iPhone) overload one shard.
* **Good shard key:** `userId` or compound `{ userId, createdAt }`.

### 🌍 Social Network
* **Bad shard key:** `country` (low cardinality, big countries skew).
* **Good shard key:** `hashed(userId)` → spreads evenly.
* **Better (geo-queries):** compound `{ regionId, userId }`.

### 📊 Time-Series Data
* **Bad shard key:** `timestamp` → all new writes to same shard.
* **Good shard key:** compound `{ deviceId, timestamp }` → spreads load by device.
* Or `{ hashed(deviceId), timestamp }` → randomizes devices.

## ⚠️ Common Mistakes

1. **Low cardinality keys** → imbalance.
   * e.g., `gender: male/female`.
2. **Monotonic keys** → hotspot.
   * e.g., `_id` with ObjectId (increasing by time).
3. **Ignoring query patterns** → scatter-gather queries, slow.

## 🎯 Interview-Safe Answer

The perfect shard key has three properties: **high cardinality** (many unique values), **even distribution of writes** (avoids hotspots), and **alignment with query patterns** (so queries can target specific shards instead of scatter-gather).

For example, in an e-commerce system, sharding by `userId` ensures each user's data is colocated and evenly distributed, while a compound key `{ userId, createdAt }` supports both user lookups and time range queries. A bad choice would be `createdAt` alone, because it causes all new orders to pile into one shard.