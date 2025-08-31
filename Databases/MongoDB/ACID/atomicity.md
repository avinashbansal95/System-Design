# MongoDB Transactions in Node.js: Complete Guide

## 🚦 Does every MongoDB query have transaction support by default?

**No.**

- By default, every **single write query (insert/update/delete)** in MongoDB is **atomic at the document level only**.
- If you want **multi-document atomicity (ACID transaction)**, you must explicitly start a **session + transaction**.

So in Node.js, when you run something like:

```javascript
await db.collection("users").updateOne({ _id: 1 }, { $inc: { balance: -100 } });
```

👉 This is **atomic only for that one document**. It is **not** part of a transaction unless you explicitly create one.

## 🚀 How to Use Transactions in Node.js with MongoDB

Here's how you explicitly enable a transaction:

```javascript
const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
  name: String,
  balance: Number,
});

const Account = mongoose.model("Account", accountSchema);

async function runTransaction() {
  // Connect (must be to replica set/sharded cluster for transactions)
  await mongoose.connect("mongodb://localhost:27017/bank", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Debit Alice
    await Account.updateOne(
      { name: "Alice" },
      { $inc: { balance: -100 } },
      { session }
    );

    // Credit Bob
    await Account.updateOne(
      { name: "Bob" },
      { $inc: { balance: 100 } },
      { session }
    );

    // Commit
    await session.commitTransaction();
    console.log("✅ Transaction committed!");
  } catch (err) {
    console.error("❌ Transaction aborted:", err);
    await session.abortTransaction();
  } finally {
    session.endSession();
    await mongoose.disconnect();
  }
}

runTransaction();

```

## Key Requirements

Key things to notice:
- You **must start a session** (`client.startSession()`).
- You **must call** `session.startTransaction()`.
- You **must pass** `{ session }` into each query that should be part of the transaction.
- You **must commit or abort** at the end (`commitTransaction()` / `abortTransaction()`).

If you don't do this → your queries run as independent atomic operations at the **document level**, not part of a broader transaction.

## 🔒 Important Interview Points

### 1. By Default
- MongoDB queries are atomic only on a **single document**.
- You don't get multi-document ACID guarantees.

### 2. To Use Transactions in Node.js
- Explicitly create a session, start a transaction, and pass `{ session }` in each query.

### 3. Limitations in Node.js + MongoDB Transactions
- Transactions work only in **replica sets (v4.0+)** or **sharded clusters (v4.2+)**.
- They add performance overhead (keep locks, memory).
- Long-running transactions should be avoided.

## Transaction Flow Diagram

```
Normal Operation (No Transaction):
Query 1 → Document Lock → Execute → Release → Atomic ✅
Query 2 → Document Lock → Execute → Release → Atomic ✅
(Each operation is independent)

Transaction Operation:
Session Start → Transaction Begin
    ↓
Query 1 → { session } → Hold locks 🔒
    ↓
Query 2 → { session } → Hold locks 🔒
    ↓
Commit → Release all locks → All-or-Nothing ✅
```

## Comparison Table

| Approach | Atomicity Level | Performance | Use Case |
|----------|----------------|-------------|----------|
| **Default Operations** | Single document only | Fast | Most operations |
| **Explicit Transactions** | Multi-document ACID | Slower (overhead) | Bank transfers, inventory updates |

## Interview Answer Template

👉 So if in your interview they ask: **"Does MongoDB query in Node.js automatically run inside a transaction?"**

Your answer should be:

> **No. By default, only single-document writes are atomic.** To use multi-document transactions, we must explicitly start a `session` and call `startTransaction()` in Node.js, then commit or abort.

## Additional Transaction Patterns

### With Error Handling
```javascript
async function safeTransaction(operations) {
  const session = client.startSession();
  
  try {
    await session.withTransaction(async () => {
      // All operations here
      await operations(session);
    });
  } finally {
    await session.endSession();
  }
}
```

### Retry Logic
```javascript
const { withTransaction } = require('mongodb');

await session.withTransaction(async () => {
  // Operations that might need retry
  await collection.updateOne({...}, {...}, { session });
}, {
  readConcern: { level: 'majority' },
  writeConcern: { w: 'majority' }
});
```

## Key Takeaways

1. **MongoDB is not "transactional by default"** - only single documents are atomic
2. **Transactions require explicit setup** - session, startTransaction(), and passing session to queries
3. **Transactions have overhead** - use them only when you need multi-document consistency
4. **Infrastructure requirements** - replica sets or sharded clusters only
5. **Error handling is critical** - always have abort logic in place