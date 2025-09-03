# AWS RDS vs Aurora: Complete Comparison Guide

## 🔹 AWS RDS vs Aurora

**Amazon RDS (Relational Database Service)** is the managed service that lets you run popular relational databases on AWS.

* Engines supported: **MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, Aurora**.
* Aurora is actually a **special engine option inside RDS**, but it's **architecturally very different** from RDS MySQL/Postgres.

## 🔹 Key Differences

| Feature | **RDS MySQL/Postgres** | **Aurora (MySQL/Postgres compatible)** |
|---------|------------------------|----------------------------------------|
| **Architecture** | Traditional DB engine running on an EC2 instance (EBS-backed storage). | AWS-built, cloud-native DB with **separate compute & distributed storage**. Storage auto-scales across **3 AZs with 6 copies**. |
| **Storage Scaling** | Fixed size (max 64 TB for MySQL/Postgres). You provision upfront. | **Auto-scales** up to 128 TB without manual intervention. |
| **Performance** | ~Comparable to a well-tuned MySQL/Postgres on EC2. | 3–5x faster than MySQL, 2x faster than Postgres (due to distributed storage & optimizations). |
| **Replication** | Uses **binlog-based async replication**. Replica lag possible. | Replication is **storage-level, low-latency, almost synchronous**. Reader endpoints auto-balance. |
| **High Availability** | Multi-AZ = a standby instance in another AZ (failover takes 30–60s). | Built-in HA: storage replicated across 3 AZs. Failover usually < 30s. |
| **Backups** | Automated backups (snapshots + binlogs). | Continuous backups to S3 + point-in-time recovery. |
| **Read Scaling** | Create **read replicas** (async, some lag). | Up to **15 low-latency read replicas** that share the same distributed storage. |
| **Maintenance Overhead** | More tuning needed (I/O bottlenecks since storage is EBS). | Less tuning: Aurora storage auto-optimizes, faster failovers. |
| **Engine Compatibility** | Exact MySQL/Postgres (community engines). | **Aurora MySQL/Postgres compatible** — mostly same APIs, but not 100% feature identical. |
| **Cost** | Lower cost. Pay per instance + EBS storage. | Higher cost (~20–30% more), but better performance per $. |
| **Use Case** | Standard workloads, legacy migrations, when you need exact engine behavior. | Cloud-native, large-scale apps needing HA, auto-scaling, global databases. |

## 🔹 Example in Practice

### If you choose **RDS MySQL**:
* You get a **VM with MySQL installed**.
* Data is on **EBS volumes** (single-AZ or Multi-AZ mirrored).
* Scaling storage = resize EBS.
* Read replicas = separate instances with replication lag.
* Performance tied to instance size + EBS throughput.

### If you choose **Aurora MySQL**:
* Compute (DB instances) is **stateless**.
* Storage is a **distributed cluster across 3 AZs**.
* Storage auto-scales as you add data.
* Readers connect via a **single endpoint** that load-balances.
* Failover is faster since only compute changes, not storage.

## 🔹 When to Use Which?

### ✅ **Use RDS MySQL/Postgres** if:
* You want **exact engine compatibility** (no Aurora-specific differences).
* Smaller workload (< 1 TB).
* Cost-sensitive.
* Simpler app where high-end HA isn't critical.

### ✅ **Use Aurora** if:
* You need **massive scale** (tens/hundreds of TB).
* You need **low-latency replication** with many read replicas.
* You want **cloud-native HA and auto-scaling storage**.
* You're building SaaS / high-traffic apps (e.g., Shopify, Netflix, Airbnb).

## ✅ **In short**:
* **RDS MySQL = traditional managed MySQL in AWS.**
* **Aurora = AWS's cloud-native re-engineered MySQL/Postgres with distributed storage, faster replication, better HA, but higher cost.**