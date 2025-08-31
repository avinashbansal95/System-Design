# MongoDB Write Operation & Durability: Complete Summary

## 1. The Write Path

- A write request first updates the document in the **WiredTiger internal cache** (RAM).
- The operation is then logged as an entry in the **journal file**. This write is sent to the **Operating System's (OS) RAM cache** (Page Cache).

## 2. Client Acknowledgment (`j` parameter)

- **`j: false`**: The client is acknowledged **immediately** after the write is in the OS RAM cache. This is fast but **not durable**; data can be lost in a crash.

- **`j: true` (Default)**: MongoDB calls `fsync()`, forcing the OS to physically write the journal entry from its RAM to the **disk hardware**. The client is acknowledged only after this completes. This is slower but **durable**.

## 3. The 100ms Journal Flush (`commitIntervalMs`)

- **Correction**: This is a **background process** that calls `fsync()` on the journal file every 100ms.
- **Its purpose is NOT to delete old entries.** Its purpose is to **limit data loss** by ensuring the OS's RAM cache doesn't get too full. It is a safety net and does not impact client response time.

## 4. The Checkpoint (Every ~60s or 2GB of journal)

- A checkpoint is a **snapshot** of the data from the WiredTiger cache that is written to the main **data files** on disk.
- **This is the process that actually updates the main source of truth.**
- Once a checkpoint is successful, all journal entries that were created *before* it are now obsolete. The journal file can then reuse this space. **This is when old journal entries are effectively "deleted."**

## Answer: Crash Recovery Before a Checkpoint

The journal enables full recovery even if a crash happens before a checkpoint.

### On Disk After a Crash

- **Main Data Files**: Reflect the state of the last successful checkpoint (potentially 60 seconds old).
- **Journal File**: Contains a complete, sequential log of **every write operation** that occurred *after* that last checkpoint.

### The Recovery Process

1. On startup, MongoDB loads the main data files. The database is now in a stale, but consistent, state (from the last checkpoint).

2. MongoDB then reads the journal file and **replays** every single write operation in order.

3. This replay re-applies all the inserts, updates, and deletes to the database, bringing it forward in time to the moment of the last successful journal write before the crash.

4. The database is now in a stable, up-to-date state. A new checkpoint is then written to solidify this recovered state.

## Simple Analogy

**In simple terms**: The main data files are your last saved game. The journal is your list of every move you made after that save. After a crash, you reload your saved game and then replay your list of moves to get back to where you were.

## Visual Flow Diagram

```
Write Request
    ↓
1. Update WiredTiger Cache (RAM) ← Fast, in-memory change
    ↓
2. Log to Journal File → OS Page Cache (RAM) ← Write logged
    ↓
3a. j: false → Immediate ACK ← Fast but not durable
3b. j: true → fsync() → Disk → ACK ← Slower but durable
    ↓
Background: 100ms Journal Flush ← Safety net fsync()
    ↓
Background: Checkpoint (~60s) ← Updates main data files
    ↓
Journal Space Reclaimed ← Old entries can be overwritten
```

## Key Durability Guarantees

| Scenario | Data Loss Risk | Performance |
|----------|---------------|-------------|
| **`j: false`** | Up to 100ms of writes (if crash before background flush) | Fastest |
| **`j: true` (default)** | No data loss for acknowledged writes | Slower, but durable |
| **Crash before checkpoint** | No data loss - journal replay recovers all committed writes | Recovery time depends on journal size |

## Interview Key Points

> "MongoDB's durability model separates fast write acknowledgment from persistent storage updates. The journal provides immediate durability for acknowledged writes through sequential logging, while checkpoints handle the bulk update of main data files. In a crash scenario, the journal acts as a write-ahead log that can replay all operations since the last checkpoint, ensuring no committed data is lost."