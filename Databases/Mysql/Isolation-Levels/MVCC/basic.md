how is mvcc achieve din mysql in which category it falls , read committed or repetable read

# MySQL's MVCC (Multi-Version Concurrency Control) Explained

Great question 🔥 — this is the **heart of MySQL's InnoDB isolation model**. Let's break it down carefully, because **MVCC (Multi-Version Concurrency Control)** is how MySQL avoids readers blocking writers and vice versa.

## 📌 1. What is MVCC in MySQL (InnoDB)?

* MVCC = **Multi-Version Concurrency Control**.
* Instead of blocking readers/writers with heavy locks, InnoDB keeps **multiple versions of a row**.
* This allows:
  * Readers to see a **consistent snapshot**.
  * Writers to update rows without blocking readers.

👉 Implemented using **undo logs** + **transaction IDs**.

## 📌 2. How InnoDB Implements MVCC

Every row in InnoDB has hidden metadata fields:
* **DB_TRX_ID** → ID of the last transaction that modified the row.
* **DB_ROLL_PTR** → Pointer to the undo log entry (old version of row).

### 🔑 Example: Updating a Row

Row before update:

```
id=1, balance=500, trx_id=100
```

Transaction A updates:

```sql
UPDATE accounts SET balance=400 WHERE id=1;
```

* InnoDB writes new version:

```
id=1, balance=400, trx_id=200
```

* Old version (balance=500) is copied to the **undo log**.

👉 Now we have **two versions** of the row:
* Current (400, trx_id=200).
* Old (500, via undo log).

## 📌 3. How MVCC Enables Isolation Levels

When a transaction reads:
1. MySQL assigns it a **transaction ID** + snapshot of "committed trx_ids visible at start."
2. For each row, InnoDB checks:
   * If row's `trx_id` ≤ snapshot → visible.
   * If row's `trx_id` > snapshot → too new → use older version from undo log.

👉 This way, readers see a consistent view of the database without blocking writers.

## 📌 4. Which Isolation Levels Use MVCC?

### **READ COMMITTED**
* Snapshot taken **at each statement**.
* Each query sees the latest committed version at execution time.
* ✅ Prevents dirty reads.
* ❌ Allows non-repeatable reads.

### **REPEATABLE READ** (MySQL default)
* Snapshot taken **at transaction start**.
* All queries in transaction see the same snapshot, even if others commit new changes.
* ✅ Prevents dirty + non-repeatable reads.
* ❌ Phantom reads still possible.

👉 In both cases, **MVCC provides snapshots using undo logs**.

## 📌 5. SERIALIZABLE (not MVCC-only)

* At SERIALIZABLE, InnoDB adds **extra locking** (next-key locks).
* Prevents phantom reads by blocking concurrent inserts/updates into range queries.

## 📌 6. Category of MySQL MVCC

* InnoDB's MVCC implementation = **Snapshot Isolation**.
* Snapshot isolation ≈ **REPEATABLE READ** in ANSI SQL.
* MySQL's default REPEATABLE READ actually provides **slightly stronger guarantees** than standard SI because it prevents non-repeatable reads (using consistent snapshot).

## 📌 Summary

* MySQL's InnoDB uses **MVCC with undo logs + transaction IDs**.
* Every read sees a snapshot based on the isolation level:
  * **READ COMMITTED** → snapshot per statement.
  * **REPEATABLE READ (default)** → snapshot per transaction.
* MVCC prevents dirty reads and allows high concurrency by avoiding locks for readers.
* Phantom prevention requires SERIALIZABLE (extra locks).