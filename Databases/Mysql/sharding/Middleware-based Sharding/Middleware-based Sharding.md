# Middleware-based Sharding (Vitess, ProxySQL)

## Approach 2: Middleware-based Sharding (Vitess, ProxySQL)

When scale grows beyond what manual sharding can handle, companies move to **Vitess**.

## What is Vitess?

* Originally built at **YouTube**, now CNCF project.
* **Sits between your app and MySQL (RDS/Aurora)**.
* Provides:
  * **Automatic sharding** (no app-level routing).
  * **Cross-shard queries** (joins, aggregations).
  * **Resharding** without downtime.
  * Connection pooling, failover, topology management.

## How it works on AWS:

* Deploy **Vitess cluster** (vtgate + vttablet + topology service like etcd/ZooKeeper/Consul).
* Your Node.js app connects to **vtgate** (looks like a MySQL server).
* Vitess figures out:
  * Which shard to query.
  * How to route queries across shards.
  * How to merge results if needed.
* You scale RDS/Aurora backends behind Vitess.

## ✅ **Pros**:
* App stays **shard-agnostic** (no special routing logic).
* Supports **resizing & resharding**.
* Handles **cross-shard queries**.
* Production-proven at scale (YouTube, Slack, Shopify, GitHub).

## ❌ **Cons**:
* More infra complexity.
* Need to manage Vitess cluster.

## ⚡ Used by: 
**YouTube, Slack, Shopify, Square, GitHub (after their MySQL scaling issues).**

## 🔹 Which is "Best" on AWS RDS?

👉 **If you're mid-scale (tens of millions of rows, moderate concurrency):**  
➡ Start with **Application-level sharding** (manual routing in Node.js).

👉 **If you're hyperscale (billions of rows, global users, high concurrency):**  
➡ Use **Vitess on AWS Aurora MySQL (or PlanetScale)** — this is what **Shopify, Slack, YouTube** do.

**Most big tech (Uber, Slack, Airbnb, Pinterest)** started with **Application-level sharding** and later moved to **Vitess** when things got unmanageable.

## 🔹 Example: Best Practice Playbook for AWS RDS + Node.js

1. **Pick a Shard Key** (usually `user_id` or `tenant_id`).
2. **Create multiple RDS clusters** (Aurora if possible).
3. **Application-level routing**:
   * Store shard map in DynamoDB or Redis.
   * Route queries in Node.js using modulus or range mapping.
4. **Introduce ProxySQL** if you want connection pooling + routing rules.
5. **Migrate to Vitess** if you need:
   * Transparent sharding.
   * Online resharding.
   * Cross-shard queries.
   * Global scale.

## ✅ **Summary**:

* **Best industry practice**: Start with **App-level sharding** (cheap, simple) → move to **Vitess** when scaling pain kicks in.
* On AWS RDS, **Aurora + Vitess** is the gold standard for hyperscale companies.
* Node.js fits naturally with both approaches (manual shard routing or connecting via Vitess as if it's a single DB).