so basically here also write in master happen first just like in rds , it's just it supports write quorum (4 of 6 copies) so no lag is there
but latency would be more
is it right

# Aurora Write Latency: Why Quorum Writes Don't Slow Things Down

## Similarity: Writes Start at the Writer (Master)

* Yes ✅ — in **both RDS and Aurora**, the **client always talks to the writer (primary)** for any write.
* The writer is responsible for generating the redo/transaction logs and coordinating the commit.

So in that sense → **"write in master happens first"** is correct.

## 🔹 Difference: Where the Data Is Written

### In **RDS**:
* Writer writes to **local EBS volume**.
* Then binlogs are shipped to replicas → **replica lag**.

### In **Aurora**:
* Writer does **not persist full pages locally**.
* Instead, it sends **redo log records directly to Aurora's distributed storage** (6 copies across 3 AZs).
* Commit is acknowledged once **4 of 6 copies confirm (write quorum)**.
* Replicas don't need separate log shipping → **near-zero lag**.

👉 The **storage layer, not the writer instance, is the source of truth**.

## 🔹 Latency Impact (Your Question)

You're right — waiting for a **quorum write (4 of 6 copies across 3 AZs)** sounds like it would add latency. But here's the trick:

* Aurora's **storage layer is highly optimized**:
  * Redo logs are **smaller than page writes** (so less I/O).
  * Writes to 6 nodes happen **in parallel** with a quorum commit (not sequential).
  * Networking between Aurora compute ↔ storage is **purpose-built, low latency** inside AWS.

👉 So in practice:
* Aurora write latency is **comparable to RDS (sometimes lower)** even though quorum is required.
* AWS claims **Aurora can be faster than MySQL by 3–5x** because it avoids local double writes (InnoDB's redo log + data file write).

## 🔹 Recap in Your Words

✔️ Yes, writes start at the master in Aurora too.  
✔️ Aurora commits only after a **quorum (4 of 6)** storage nodes confirm durability.  
✔️ This removes **replica lag** (since replicas read the same shared storage).  
❌ Latency isn't necessarily higher — because Aurora optimizes the storage path vs RDS's heavier binlog + page write cycle.

✅ So the "extra latency" you're thinking of is **offset (and often outweighed)** by Aurora's **more efficient logging model + parallel quorum writes**.