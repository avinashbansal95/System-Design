# RDS Multi-AZ vs Read Replicas Architecture Guide

## 1. Multi-AZ RDS (High Availability)

* Multi-AZ = **one primary + one standby**.
* Both are in the **same region** but in **different AZs** (data centers).
* **All reads + writes go to the primary only.**
* The **standby is hidden**, not used for reads.

👉 So in Multi-AZ setup:
* You have **only one active DB instance** per region (the primary).
* The standby exists just for failover.

## 2. Read Replicas in RDS (Scalability)

* You can add **read replicas** to the primary.
* Replicas can be:
   * In the **same region** (in another AZ).
   * In a **different region** (cross-region read replica).
* Replication is **asynchronous** (so lag can exist).
* Replicas **can serve read queries**.

👉 So in a region, you can have:
* **One master (primary)**.
* **Multiple read replicas** for read scaling.

## 3. Combined Setup in One Region

Yes ✅ — you can combine both:
* **Multi-AZ Primary** (for HA).
* **Multi-AZ Read Replicas** (for scaling + redundancy).

**Example in `us-east-1`:**
* Primary DB in **AZ-1a**.
* Standby DB in **AZ-1b** (HA, hidden).
* 2 Read Replicas in **AZ-1c** and **AZ-1d**.

👉 **Flow:**
* **Writes** → go to primary (AZ-1a).
* **Reads** → can be directed to replicas (AZ-1c, AZ-1d).
* If primary fails → standby (AZ-1b) becomes new primary, and replication continues.

## 4. Multi-Region Setup (Cross-Region Read Replicas)

* You can also create **cross-region read replicas** (async replication across regions).
* **Example:**
   * Primary in `us-east-1`.
   * Read replica in `eu-west-1`.

👉 **Use cases:**
* Disaster recovery (DR).
* Serving global users with low read latency.

## 5. Architecture Choices in RDS

| Setup | Reads | Writes | Failover | Use Case |
|-------|-------|--------|----------|----------|
| **Single-AZ** | Primary only | Primary only | None | Dev/test |
| **Multi-AZ** | Primary only | Primary only | Auto failover | HA in one region |
| **Read Replicas** | Replicas | Primary only | Manual promote | Read scaling |
| **Multi-AZ + Read Replicas** | Replicas | Primary only | Auto failover | HA + scaling |
| **Cross-Region Replicas** | Remote region replicas | Primary only | Manual promote | Global apps + DR |

## Answer to Your Exact Questions

* ✅ Yes, in **Multi-AZ RDS**, **all reads and writes happen in one region, on the primary instance only.**
* That region can have **one master + multiple read replicas**.
* The standby (Multi-AZ) is **not used for reads**, only for failover.