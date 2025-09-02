# 📌 MySQL Architecture Overview

At a high level, MySQL is built in **layers**:

```
+------------------------+
|   Client Layer (SQL)   |  ← Queries from apps
+------------------------+
|  Parser / Optimizer    |  ← SQL parsing, query planning
+------------------------+
|   Storage Engine API   |  ← Plugin interface
+------------------------+
| Storage Engines (InnoDB, MyISAM, etc.) |
+----------------------------------------+
|   Disk / OS Filesystem (Data, Logs)    |
+----------------------------------------+
```

* **SQL Layer**: query parsing, optimization, caching.
* **Storage Engine**: actually stores/retrieves data.
* **Popular engine = InnoDB** (default since MySQL 5.5).

# 📌 InnoDB (Default Engine) — How It Works

## 🔑 Key Components

1. **Buffer Pool** (like MongoDB's WiredTiger cache)
   * Memory area where frequently used pages (data + indexes) are cached.
   * All reads/writes go through buffer pool.
   * Write = update in memory + mark page as "dirty."

2. **Redo Log (Write-Ahead Log)**
   * Sequential log of changes (before flushing dirty pages).
   * Guarantees **durability**: crash recovery uses redo log.

3. **Undo Log**
   * Stores old values for transactions (used for rollback & MVCC).

4. **Doublewrite Buffer**
   * Protects against partial page writes (if crash happens mid-write).

5. **Data Files** (`.ibd`)
   * Actual table/index data on disk.

# 📌 MySQL Write Path (Step by Step)

Suppose you run:

```sql
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
```

## Step 1: In Buffer Pool (RAM)
* MySQL fetches the page (`id=1`) into **Buffer Pool**.
* Updates `balance` in memory.
* Marks that page as **dirty**.

👉 This is just like MongoDB's **WiredTiger cache update**.

## Step 2: Write-Ahead Logging
* Change is also appended to **Redo Log** (sequential write).
* Redo log ensures **durability** — even if MySQL crashes, the update can be replayed.

👉 This is like MongoDB's **journal file**.

## Step 3: Commit
* At commit, the transaction is recorded in **Redo Log** + binlog (if replication).
* Undo log entry is written for rollback/versioning.

## Step 4: Flushing to Disk
* Later (not immediately), background thread flushes dirty pages from buffer pool → data files (`.ibd`).
* Uses **Doublewrite Buffer** to ensure crash safety.

# 📌 Comparing with MongoDB (WiredTiger)

| Feature | MongoDB (WiredTiger) | MySQL (InnoDB) |
|---------|---------------------|----------------|
| **In-memory cache** | WiredTiger cache | InnoDB Buffer Pool |
| **Write durability** | Journal (write-ahead log) | Redo log (write-ahead log) |
| **Rollback** | WiredTiger history store | Undo log |
| **Crash protection** | Journal replay | Doublewrite buffer + redo log replay |
| **Data files** | `.wt` files | `.ibd` files |

👉 **Big picture:**
* Both MongoDB and MySQL use **Write-Ahead Logging + in-memory caching**.
* Both don't flush changes to disk immediately → instead rely on **logs for durability** and **background flush for efficiency**.
* MongoDB's **WiredTiger Journal** ≈ MySQL's **Redo Log**.
* MongoDB's **cache** ≈ MySQL's **Buffer Pool**.

# 📌 Real-Life Example: Write in Both DBs

## In MongoDB (WiredTiger)
1. Write goes to WiredTiger cache.
2. Change appended to journal.
3. Later → flush to data files.

## In MySQL (InnoDB)
1. Write goes to Buffer Pool (RAM).
2. Change appended to Redo Log.
3. Later → flush dirty pages to `.ibd` files (with doublewrite protection).

# 🎯 Interview-Safe Answer

MySQL's InnoDB engine, like MongoDB's WiredTiger, uses a mix of in-memory caching and write-ahead logging. InnoDB writes go to the **Buffer Pool** (like WiredTiger cache) and are marked dirty. At the same time, the changes are logged in the **Redo Log** for durability (similar to MongoDB's journal). Undo logs are used for rollback and MVCC, and dirty pages are flushed later to `.ibd` data files using a **doublewrite buffer** for crash safety. So yes, just like MongoDB, MySQL does not immediately persist writes to data files — it relies on WAL + caching to balance durability and performance.