# MongoDB ACID Consistency Guide 🚀

Consistency is often the trickiest ACID property to reason about in MongoDB, because it behaves differently than RDBMS like MySQL. Let's carefully break it down with theory + how MongoDB ensures it + examples + limitations.

## 🔑 1. What is Consistency (in ACID)?

**Definition:** The database must move from one valid state to another valid state, never violating constraints, invariants, or rules.

**Example (Banking):** If Alice transfers $200 to Bob, the total money in the system must remain constant (sum before = sum after).

So, Consistency means:
- No broken invariants
- No half-complete state
- Rules (like unique keys, schema validation) must hold before and after transactions

## 🔑 2. How MongoDB Ensures Consistency

### a) Document-Level Guarantees

- Every single document write is atomic → MongoDB guarantees that no partial writes occur
- Invariants within a single document are never broken

✅ **Example:**
```javascript
db.accounts.updateOne(
  { _id: 1 },
  {
    $inc: { balance: -200 },
    $push: { transactions: { to: "Bob", amount: -200 } }
  }
)
```

👉 Even though this updates two fields (balance, transactions), MongoDB ensures both succeed together — never half-applied.

### b) Constraints & Validation

MongoDB enforces schema validation (JSON Schema), unique indexes, and other rules to prevent invalid states.

✅ **Example:**
```javascript
// Unique constraint on email
db.users.createIndex({ email: 1 }, { unique: true });

// This will fail if email already exists
db.users.insertOne({ name: "Alice", email: "alice@example.com" });
```

👉 Consistency preserved: no two users can have the same email.

### c) Multi-Document Transactions (4.0+)

If you modify multiple documents in a transaction → either all commit or all rollback.
Ensures the system never lands in an inconsistent "half-updated" state.

✅ **Example:**
```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  await Account.updateOne({ name: "Alice" }, { $inc: { balance: -200 } }, { session });
  await Account.updateOne({ name: "Bob" }, { $inc: { balance: 200 } }, { session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
}
```

👉 If crediting Bob fails, debiting Alice is rolled back → consistency maintained.

### d) Replica Sets & Write Concern

- Consistency across replicas is controlled via write concern
- Example: `w: "majority"` ensures a write is only acknowledged when most replicas have written it
- Prevents stale/dirty reads from lagging secondaries

✅ **Example:**
```javascript
db.accounts.updateOne(
  { _id: 1 },
  { $inc: { balance: -200 } },
  { writeConcern: { w: "majority", j: true } }
)
```

👉 Guarantees durability + consistency across the cluster.

## 🔎 3. Where MongoDB Consistency is Weaker vs RDBMS

### No Foreign Keys

- You can reference documents across collections, but MongoDB won't enforce referential integrity
- Application logic must ensure consistency

❌ **Example:**
```javascript
// "orders" refers to a user_id
db.orders.insertOne({ user_id: 123, product: "Laptop" });
```

👉 If `user_id: 123` doesn't exist in users, MongoDB doesn't care — you must enforce it in app code.

### Replica Lag

- If you read from a secondary with `readPreference: secondary`, you might get stale data (eventual consistency)
- To enforce strict consistency, you must read from primary

## 🎯 Interview-Safe Answer

MongoDB ensures consistency in multiple ways:

1. **At the document level**, writes are atomic, so invariants within a document are never broken
2. **It enforces constraints** like unique indexes and schema validation
3. **With multi-document transactions** (v4.0+), MongoDB guarantees consistency across documents — all updates succeed or none do
4. **At the cluster level**, write concern ensures consistency across replicas

However, unlike RDBMS, MongoDB does **not support foreign keys**, so cross-collection consistency must be handled in the application. Also, if you read from secondaries, you may see stale data due to replication lag.