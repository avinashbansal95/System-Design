epxlain the concept of pages and what do you mean by mark dirty? what happens when you do that and when would you do that

# MySQL InnoDB Pages and Dirty Pages

## 🔑 1. What is a Page?

* InnoDB stores all data (tables + indexes) in **fixed-size units called pages**.
* **Default page size = 16KB** (configurable at build time).
* A page = the smallest unit of I/O in InnoDB.

👉 When you read from disk or cache in buffer pool → you're always dealing with **whole pages**, not individual rows.

## 🔑 2. Types of Pages

* **Data pages**: contain table rows.
* **Index pages**: contain B+ tree nodes.
* **Undo log pages**, **system pages**, etc.

**Example:** If you have 1 million rows in a table, those rows are distributed across many 16KB pages.

# 📌 Dirty Pages in InnoDB

## 🔑 1. What Does "Dirty" Mean?

* A **dirty page** = a page in the buffer pool that has been **modified in memory** but not yet written to disk.

## 🔑 2. Example of a Dirty Page

Suppose you run:

```sql
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
```

**Steps:**
1. InnoDB loads the page containing `id=1` into **Buffer Pool** (if not already).
2. It subtracts `100` from the `balance`.
3. That page in RAM now differs from what's on disk → **marked dirty**.
4. InnoDB also writes an entry to the **Redo Log** (so the change isn't lost if crash happens).

👉 Now the dirty page sits in memory until InnoDB decides to flush it to disk.

## 🔑 3. Why Mark Pages Dirty?

* To avoid immediate disk writes on every update.
* Writing to memory (RAM) is fast. Writing to disk is slow.
* Instead of flushing every change immediately, InnoDB batches them:
   * Mark pages dirty when updated.
   * Keep them in RAM.
   * Later, background threads flush dirty pages in bulk.

👉 This improves throughput massively.

# 📌 When Are Dirty Pages Flushed?

InnoDB flushes dirty pages in scenarios like:

## 1. **Checkpointing**
* Periodically, InnoDB flushes dirty pages so that the redo log doesn't grow indefinitely.
* Ensures crash recovery doesn't take forever.

## 2. **Buffer Pool Pressure**
* If buffer pool is full and a query needs a new page, InnoDB evicts some pages.
* Dirty pages must be flushed before eviction.

## 3. **Shutdown / Transaction Commit**
* On clean shutdown, dirty pages are flushed.
* At commit:
   * Redo log guarantees durability.
   * Pages don't have to flush immediately (depends on `innodb_flush_log_at_trx_commit`).

# 📌 Analogy

* Think of **pages = notebook pages**.
* When you update a value, you write it in **pencil in RAM** first.
* Mark it dirty = "This page needs to be recopied into the official clean book later."
* Redo log = "scratch pad" that records what changes you made, in case the notebook is lost.
* Eventually, you rewrite the clean copy on disk.

# 🎯 Interview-Safe Answer

In MySQL InnoDB, data and indexes are stored in fixed-size **pages** (16KB). When you update a row, InnoDB loads the page into memory (buffer pool), applies the change, and marks that page as **dirty** — meaning it differs from what's on disk. Dirty pages aren't flushed immediately; instead, changes are logged in the redo log for durability, and the page remains dirty in memory until background processes or checkpoints flush it to disk. This allows MySQL to batch writes and significantly improve performance compared to flushing on every update.