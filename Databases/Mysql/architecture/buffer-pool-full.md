# Insert Flow in MySQL When Buffer Pool is Full

## Step 0: State Before Insert
* Buffer Pool = **full** (all 16KB pages in RAM are in use).
* Some pages are **clean** (same as disk), some are **dirty** (modified but not flushed).

## Step 1: New Insert Arrives

```sql
INSERT INTO accounts (id, name, balance) VALUES (2001, 'Alice', 500);
```

* InnoDB must place this new row in the **appropriate B+Tree index page** (leaf node).
* That page must be in Buffer Pool before it can be updated.

## Step 2: Need Space in Buffer Pool
* Since Buffer Pool is full, InnoDB uses **LRU (Least Recently Used)** eviction strategy.
* Candidate page for eviction is chosen.

👉 Two cases:
1. **If page is clean** → can be evicted directly.
2. **If page is dirty** → must first be flushed (written to disk) → then evicted.

## Step 3: Load Required Page
* After eviction, InnoDB **loads the target page** (from disk) into Buffer Pool.
* This page will hold the new row (`id=2001`).

## Step 4: Apply Insert in Buffer Pool
* Row `{2001, 'Alice', 500}` is added into the in-memory B+Tree page.
* Page is marked **dirty** because it differs from disk.

## Step 5: Write-Ahead Logging
* Insert also written to **Redo Log**.
* Undo Log entry created (for rollback/MVCC if needed).

## Step 6: Commit
* On commit:
   * Redo Log entry flushed to disk (depends on `innodb_flush_log_at_trx_commit`).
   * Dirty page **remains in Buffer Pool** (not flushed immediately).

## Step 7: Later (Checkpoint or Eviction)
* Background thread eventually **flushes dirty page** to disk.
* Disk (`.ibd` file) now has the new row permanently.
* Redo log entries ≤ checkpoint LSN are purged/overwritten.

# 📌 Flow Summary (Insert with Full Buffer Pool)

1. Buffer pool full → pick page for eviction.
2. If dirty → flush to disk, then evict.
3. Load required page from disk.
4. Apply insert in buffer pool → page marked dirty.
5. Write redo log + undo log.
6. Commit → durability guaranteed via redo log.
7. Later: dirty page flushed → data file updated.

# 📌 Analogy

Think of Buffer Pool as your **desk**:
* If the desk is full and you want to add a new file →
   * Remove an old clean file (easy) OR
   * Save a modified file to cabinet (disk) before removing.
* Then bring the new file from the cabinet → update it on your desk.
* Later, when things calm down, you sync the updated file back to the cabinet.

# 🎯 Interview-Safe Answer

When the Buffer Pool is full, InnoDB must evict a page before inserting new data. If the page chosen is dirty, it's flushed to disk first. Then the required page is loaded into the Buffer Pool, and the insert is applied in memory, marking the page dirty. The insert is also recorded in the redo log for durability. On commit, redo log guarantees persistence, while the dirty page is flushed to disk later during a checkpoint or eviction. This design allows MySQL to batch disk I/O while still ensuring crash-safe durability.