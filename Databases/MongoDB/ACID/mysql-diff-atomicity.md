# RDBMS vs MongoDB: Atomicity Comparison

This is exactly the kind of **system design / database fundamentals** comparison interviewers love. Let's break it down in a structured way so you can confidently explain the **atomicity difference between RDBMS (like MySQL) and NoSQL (like MongoDB)**.

## 1. Atomicity in MySQL / RDBMS

- **Transactions are built-in and multi-row, multi-table by default.**
- You can group multiple operations (across multiple rows/tables) into a single transaction.
- Either **all succeed** (commit) or **none happen** (rollback).
- ACID is **native and strong** — atomicity is across the entire transaction boundary.

### Example (MySQL):

```sql
START TRANSACTION;

UPDATE accounts SET balance = balance - 100 WHERE name = 'Alice';
UPDATE accounts SET balance = balance + 100 WHERE name = 'Bob';

COMMIT;  -- or ROLLBACK;
```

Both statements are part of the same atomic transaction.

## 2. Atomicity in MongoDB

### By default (before v4.0):
- Atomicity was **only at the document level**.
- If you updated multiple fields in one document, that was atomic.
- But if you updated multiple documents, it was **not atomic by default**.

### Since MongoDB v4.0 (replica sets) & v4.2 (sharded clusters):
- MongoDB added support for **multi-document transactions**.
- Now you can get RDBMS-like atomicity, but you must explicitly start a **session + transaction**.

### Example (MongoDB):

```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  await Account.updateOne({ name: "Alice" }, { $inc: { balance: -100 } }, { session });
  await Account.updateOne({ name: "Bob" }, { $inc: { balance: 100 } }, { session });

  await session.commitTransaction();
} catch (e) {
  await session.abortTransaction();
}
```

Without session/transaction → each `updateOne` runs independently and is only atomic **per document**.

## 3. Key Differences in Atomicity: RDBMS vs MongoDB

| Feature | MySQL / RDBMS | MongoDB |
|---------|---------------|---------|
| **Default Scope** | Multi-row, multi-table (full transaction) | Single-document (default), multi-document requires explicit transaction |
| **Transactions** | Native, always available | Supported since v4.0+ (replica sets), v4.2+ (sharded clusters) |
| **Foreign Keys** | Enforced at DB-level, helps consistency in transactions | Not supported — must handle referential integrity at app-level |
| **Performance** | Transactions optimized over decades, efficient | Multi-document transactions add overhead, slower in distributed setups |
| **Isolation Levels** | Multiple (READ COMMITTED, REPEATABLE READ, SERIALIZABLE) | Snapshot isolation (no SERIALIZABLE by default) |
| **Atomic Guarantee** | Strong (across multiple tables/rows) | Strong at document level, multi-document only with explicit transaction |

## Example Scenario: Money Transfer

### MySQL:
By default, transferring money between Alice and Bob is a single atomic unit (`START TRANSACTION ... COMMIT`).

### MongoDB:
Without transactions, you could debit Alice but fail to credit Bob (inconsistency). With transactions (`session.startTransaction()`), you can achieve the same atomic guarantee.

## Visual Comparison

### MySQL Default Behavior
```
START TRANSACTION
    ↓
UPDATE accounts (Alice) ← Part of transaction
    ↓
UPDATE accounts (Bob) ← Part of transaction
    ↓
COMMIT ← All-or-nothing guarantee
```

### MongoDB Default Behavior
```
updateOne(Alice) ← Atomic per document
    ↓
updateOne(Bob) ← Separate atomic operation
    ↓
No guarantee both succeed together ❌
```

### MongoDB With Transactions
```
session.startTransaction()
    ↓
updateOne(Alice, { session }) ← Part of transaction
    ↓
updateOne(Bob, { session }) ← Part of transaction
    ↓
session.commitTransaction() ← All-or-nothing guarantee ✅
```

## Interview-Safe Answer

> In MySQL and most RDBMS, atomicity is provided at the transaction level by default — you can update multiple rows and tables atomically. In MongoDB, atomicity is guaranteed at the **document level by default**, but since v4.0 it supports multi-document transactions. However, you must explicitly create a transaction session to achieve RDBMS-like atomicity. Transactions in MongoDB also introduce performance overhead and don't support features like foreign keys, so consistency across collections often has to be handled at the application level.

## When to Use Each Approach

### Choose RDBMS (MySQL) When:
- You need complex transactions across multiple entities
- Strong consistency is critical
- You have well-defined relationships between data
- ACID properties are non-negotiable

### Choose MongoDB When:
- Your data is primarily document-based
- You need horizontal scaling capabilities
- Most operations are single-document
- You can handle consistency at the application level

## Key Takeaways

1. **RDBMS**: Transactions are the default, multi-table atomicity is built-in
2. **MongoDB**: Document-level atomicity is default, multi-document requires explicit transactions
3. **Performance**: RDBMS transactions are more optimized, MongoDB transactions add overhead
4. **Consistency**: RDBMS handles referential integrity at DB level, MongoDB requires application-level handling
5. **Evolution**: MongoDB has been moving toward RDBMS-like features while maintaining NoSQL benefits