# Aurora vs RDS MySQL: Write Path Architecture

## 🔹 Traditional RDS MySQL Write Path

1. Client sends `INSERT`.
2. Primary (master) writes changes to:
   * Local buffer pool (memory).
   * Local redo logs / binlogs.
3. Commit acknowledged.
4. Replicas later **pull binlogs**, replay them, update their own storage. 

👉 That's why **replica lag exists**.

## 🔹 Aurora Write Path (the magic sauce)

Aurora flips the model — **the storage is shared and distributed**.

### What happens on `INSERT`:

1. **Application → Aurora Writer Node (compute instance)**.
2. Writer generates **redo log records** (not full page writes).
3. Redo logs are sent **directly to Aurora's distributed storage layer**:
   * Storage is replicated **6 times across 3 AZs**.
   * Commit is acknowledged **only after a write quorum (4 of 6 copies)** succeed.
4. Aurora Writer returns **success (commit)** to client.
5. Reader replicas:
   * Already share the **same storage layer**.
   * They don't replay binlogs — they just **apply the new redo logs from storage** into their buffer pool if needed.

## 🔹 Key Clarification

* The **data isn't first written to storage and then to the master**.
* Instead, the **master (writer) generates redo logs**, which are **pushed to the shared storage layer** (not stored locally like RDS).
* The **storage layer is the source of truth**, not the master's local disk.
* Replicas don't "write at the same time" — they just **see the same storage updates** since storage is shared.

## 🔹 Visual Flow (Aurora Insert)

```
App → Writer Node → Redo Logs → Aurora Distributed Storage (6 copies across 3 AZs)
                            ↘
                             Replicas read same storage (near-zero lag)
```

## 🔹 Why This Matters

* **No binlog shipping** → near-zero replica lag.
* **No double writes** (writer + replica) → efficiency.
* **Shared truth = storage** → replicas are stateless and can be spun up fast.

## ✅ So, to answer your exact phrasing:

* When an `INSERT` comes:
  * The **writer generates redo logs** and sends them to **Aurora shared storage**.
  * **Commit is acknowledged once storage confirms durability** (quorum).
  * **Replicas don't write separately**; they just query the **same shared storage** and stay consistent.