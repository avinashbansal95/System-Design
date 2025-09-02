What happens if MySQL crashes while dirty pages are in memory?”
# 📌 Crash Recovery with Dirty Pages in InnoDB

## 🔑 1. Situation Before Crash

* A page is updated in the **buffer pool** (RAM).
* Page is marked **dirty** (differs from disk copy).
* The change is also written to the **Redo Log** (write-ahead log).
* Disk still has the old page.

Example:

```sql
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
```

* Buffer Pool: `balance = 900` (dirty page).
* Disk: `balance = 1000` (stale copy).
* Redo Log: "Subtract 100 from id=1."

## 🔑 2. Crash Happens ⚡

* Memory (buffer pool) is wiped.
* Dirty pages that were never flushed are lost.
* But Redo Log is still on disk (sequential, durable).

## 🔑 3. Recovery After Restart

When MySQL restarts:

1. **Redo Phase**
   * InnoDB scans the **Redo Log**.
   * Re-applies any operations that were committed but not yet flushed.
   * Example: subtract 100 from id=1 → page reloaded into buffer pool → applied again → now balance=900.

2. **Undo Phase** (if needed)
   * Uses **Undo Log** to roll back uncommitted transactions.
   * Ensures atomicity (no partial transactions).

👉 Result: database returns to a **consistent state** — as if the crash never happened.

## 🔑 4. Why This Works (Write-Ahead Logging)

* Writes are **first logged (Redo Log)** before marking pages dirty.
* Guarantee: If MySQL acknowledges a commit, redo log has it safely.
* Even if dirty pages never reached disk, redo log can replay them.

👉 Same principle as MongoDB's **journal + WiredTiger cache**.

## 🔎 Example Timeline

1. Update made → Page dirty in buffer pool → Redo Log entry written.
2. Crash occurs before page flushed.
3. On restart → InnoDB reads redo log → replays update → page = correct again.

Without redo log → you'd lose that update.

# 📌 Configurable Durability

Controlled by `innodb_flush_log_at_trx_commit`:

* **1 (default, safest)** → Redo Log flushed to disk on every commit. Strong durability.
* **2** → Redo Log written to OS cache (not fsync) at commit → crash risk if OS crashes.
* **0** → Redo Log flushed periodically, not at each commit → fastest but weakest.

👉 In high-throughput systems, durability vs performance is a trade-off.

# 🎯 Interview-Safe Answer

If MySQL crashes with dirty pages in memory, those pages are lost, but the changes are preserved in the redo log. On restart, InnoDB replays the redo log to reapply committed changes to the pages on disk. Any uncommitted transactions are rolled back using the undo log. This ensures atomicity and durability. The redo log is the key — it guarantees that committed transactions survive crashes even if dirty pages were never flushed.