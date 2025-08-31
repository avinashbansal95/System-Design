# MongoDB Sharding Complete Guide

## 🔑 1. What is Sharding?

**Sharding = Horizontal partitioning of data across multiple machines.**

- Instead of putting all data on one server (vertical scaling), MongoDB distributes it into shards
- Each shard holds only a portion of the data
- A mongos router routes queries to the right shard(s)

👉 **Purpose:** Scalability (handle large datasets + high throughput)

## 🔑 2. Why Sharding is Needed?

MongoDB on a single node (even replica set) has limitations:

- Storage capacity limited by a single machine
- Query throughput limited by CPU/RAM of one node

**Sharding solves:**
- Big data scaling (billions of docs, TBs+)
- High write throughput
- Distributing load evenly across machines

## 🔑 3. MongoDB Sharded Cluster Architecture

### Shards
- Each shard is a replica set
- Stores a subset of data
- Provides high availability + partitioning

### Config Servers (CSRS)
- Stores metadata (chunk ranges, shard mapping)
- Usually 3 config servers for fault tolerance

### mongos (Query Router)
- Entry point for applications
- Client doesn't know where the data lives → mongos routes queries to correct shard(s)

## 🔑 4. How Sharding Works

MongoDB decides where to place a document using:

### Shard Key
- A field (or compound fields) chosen at collection level
- Determines partitioning of data
- Every document must include the shard key

### Chunks
- Data is divided into ranges of shard key values
- Each chunk ~ 64MB
- Chunks are distributed across shards

### Balancing
- If one shard has too many chunks, MongoDB automatically migrates chunks to keep balance

## 🔑 5. Choosing a Shard Key (CRUCIAL for Interviews)

Shard key design can make or break performance.

### ✅ Good Shard Key
- **High Cardinality** (many unique values)
- **Even Distribution** of data
- **Commonly Queried** fields

### ❌ Bad Shard Key
- **Low cardinality** → few distinct values → hotspot
- **Monotonically increasing values** (like _id timestamp) → all new writes go to one shard → write hotspot

## 🔑 6. Types of Shard Keys

### 1. Hashed Sharding
- Applies a hash function to the shard key
- Distributes documents randomly across shards
- **Good for:** write scalability
- **Bad for:** range queries

### 2. Range Sharding
- Documents distributed by ranges of shard key values
- **Great for:** range queries (e.g., time series)
- **Risk:** hotspots if new inserts always fall in same range

### 3. Zone Sharding (Tag Aware)
- Assign chunks to specific shards based on shard key ranges
- **Example:** Users in India stored in Shard A, Users in US stored in Shard B
- **Useful for:** geo-locality & compliance

## 🔑 7. Query Routing in Sharded Cluster

- **If query includes shard key** → mongos routes to one shard only (fast)
- **If query does not include shard key** → query must scatter-gather across all shards (slow)

👉 **Always design queries & indexes to include shard key**

## 🔑 8. Transactions in Sharded Clusters

- **Pre v4.2:** Transactions limited to single shard
- **MongoDB 4.2+:** Supports multi-shard transactions, but with overhead (two-phase commit under the hood)

## 🔑 9. Real-World Example

**Example: E-commerce Orders System**

**Collection:** `orders`

**Shard Key Options:**

1. `userId` → distributes evenly, but range queries by orderDate need scatter-gather
2. `orderDate` → good for analytics, but all new writes go to the "latest date shard" → hotspot
3. **Compound key `{ userId, orderDate }`** → balances better, supports both queries

## 🔑 10. Limitations of Sharding

- Shard key is **immutable** (cannot be changed after collection is sharded)
- Poor shard key choice = hotspots + performance issues
- Cross-shard joins and aggregations are expensive
- Multi-shard transactions slower (uses 2PC)
- Operational overhead (config servers, mongos, balancing)

## 🔑 11. Common Interview Qs (with 20s answers)

### When would you shard a MongoDB cluster?
👉 When dataset > single node capacity or write throughput > single node can handle.

### What makes a good shard key?
👉 High cardinality, evenly distributed, commonly queried.

### What happens if query doesn't include shard key?
👉 Mongos performs scatter-gather across all shards → slower.

### Difference between Hashed vs Range sharding?
👉 Hashed = even distribution, bad for ranges. Range = good for ranges, risk of hotspot.

### How does MongoDB balance shards?
👉 Automatically migrates chunks between shards based on config metadata.