# MongoDB Isolation & MVCC: Complete Guide

## First: MongoDB Isolation Recap

- MongoDB transactions use **MVCC** (Multi-Version Concurrency Control).
- Each transaction sees a **snapshot** of the data at the moment it started.
- Reads inside a transaction never see uncommitted writes from other transactions.
- If **two transactions update the same document**, the **second committer loses** — MongoDB will abort it to maintain isolation, and you must retry.

## Real-Life Example: Bank Transfer

We have an `accounts` collection:

```json
{ "_id": 1, "name": "Alice", "balance": 1000 }
{ "_id": 2, "name": "Bob", "balance": 500 }
```

### Scenario
Two concurrent transactions try to update **Alice's account** at the same time.

### Transaction A (T1) — ATM withdrawal

- Starts at **time T0**.
- Snapshot: Alice has `balance = 1000`.
- Updates Alice's balance: `1000 - 200 = 800`.
- Prepares to `commit`.

```javascript
session1.startTransaction();
db.accounts.updateOne({ _id: 1 }, { $inc: { balance: -200 } }, { session: session1 });
```

### Transaction B (T2) — Online purchase

- Starts **after T1 but before T1 commits**.
- Snapshot: Alice still has `balance = 1000` (because it doesn't see T1's uncommitted write).
- Updates Alice's balance: `1000 - 300 = 700`.
- Prepares to `commit`.

```javascript
session2.startTransaction();
db.accounts.updateOne({ _id: 1 }, { $inc: { balance: -300 } }, { session: session2 });
```

## Conflict Resolution

Both T1 and T2 want to update the **same document** (`_id: 1`).
MongoDB detects this conflict when **T2 tries to commit**.

### Outcome

1. **T1 commits first → success.** Alice's balance becomes `800`.
2. **T2 commits next → conflict detected.**
   - T2's snapshot is stale (it thought Alice had `1000`, but it was already `800`).
   - MongoDB **aborts T2** with a `WriteConflict` error.

The app must **retry T2**. When retried, it will read the new snapshot (`balance = 800`), and apply `-300`, making the balance `500`.

## Timeline Visualization

```
Time    T1 (ATM)              T2 (Online)           Database State
T0      Start transaction     -                     Alice: 1000
T1      Read Alice: 1000      Start transaction     Alice: 1000
T2      -                     Read Alice: 1000      Alice: 1000
T3      Update: -200          -                     Alice: 1000 (uncommitted)
T4      -                     Update: -300          Alice: 1000 (T2's view)
T5      COMMIT SUCCESS        -                     Alice: 800 (committed)
T6      -                     COMMIT FAILED         WriteConflict Error
T7      -                     RETRY: Read 800       Alice: 800
T8      -                     Update: -300          Alice: 800
T9      -                     COMMIT SUCCESS        Alice: 500
```

## Error Handling Pattern

```javascript
async function transferMoney(fromId, toId, amount) {
  const session = client.startSession();
  
  let retries = 3;
  while (retries > 0) {
    try {
      session.startTransaction();
      
      await db.accounts.updateOne(
        { _id: fromId }, 
        { $inc: { balance: -amount } }, 
        { session }
      );
      
      await db.accounts.updateOne(
        { _id: toId }, 
        { $inc: { balance: amount } }, 
        { session }
      );
      
      await session.commitTransaction();
      break; // Success, exit retry loop
      
    } catch (error) {
      await session.abortTransaction();
      
      if (error.code === 112) { // WriteConflict
        retries--;
        continue; // Retry
      } else {
        throw error; // Other error, don't retry
      }
    }
  }
}
```

## Key Takeaways

- MongoDB uses **snapshot isolation** (like PostgreSQL).
- Reads inside a transaction are from a **consistent snapshot** at transaction start.
- **Conflicting writes → one transaction wins, the other aborts** (`WriteConflict`), and the app must retry.
- This prevents anomalies like dirty reads and non-repeatable reads.

## Isolation Levels Comparison

| Database | Default Isolation | Behavior on Conflicts |
|----------|------------------|----------------------|
| **MongoDB** | Snapshot Isolation | Abort second committer, retry required |
| **PostgreSQL** | Read Committed | Similar snapshot isolation available |
| **MySQL** | Repeatable Read | Similar but with gap locking |
| **SQL Server** | Read Committed | Various levels available |

## Interview-Safe Explanation

> MongoDB provides snapshot isolation using MVCC. Each transaction sees a snapshot of the data as of the time it started. If two concurrent transactions update the same document, MongoDB allows the first commit to succeed and aborts the second with a `WriteConflict` error. The second transaction must retry on a fresh snapshot. This way, MongoDB prevents anomalies but doesn't provide serializable isolation — it uses snapshot isolation, similar to PostgreSQL.

## Best Practices

1. **Always implement retry logic** for `WriteConflict` errors
2. **Keep transactions short** to reduce conflict probability
3. **Use appropriate timeouts** to avoid hanging transactions
4. **Consider document design** to minimize cross-document transactions
5. **Monitor transaction abort rates** in production

## Common Pitfalls

- **Not handling WriteConflict errors** - transactions will fail without retry logic
- **Long-running transactions** - increase conflict probability
- **Hot documents** - frequently updated documents cause more conflicts
- **Infinite retry loops** - always implement retry limits