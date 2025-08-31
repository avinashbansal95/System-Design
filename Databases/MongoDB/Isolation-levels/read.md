# MongoDB ACID Isolation Guide

## 🔑 1. Isolation Levels in RDBMS (for context)

In SQL databases you usually hear about:

- **Read Uncommitted** → dirty reads allowed
- **Read Committed** → no dirty reads, but non-repeatable reads possible
- **Repeatable Read** → no dirty or non-repeatable reads, but phantom reads possible
- **Serializable** → strongest; transactions behave as if run sequentially

## 🔑 2. Isolation in MongoDB

MongoDB doesn't expose all these granular isolation levels. Instead:

- **Single-document operations** → always atomic & isolated
- **Multi-document transactions (MongoDB 4.0+)** →
  - MongoDB uses **Snapshot Isolation (SI)**
  - Reads inside a transaction see a **stable snapshot** of the data at the start of the transaction
  - If two transactions modify the same document → one succeeds, the other aborts with a `WriteConflict`
- MongoDB does **not support SERIALIZABLE isolation**. Phantom reads are possible

👉 This is very similar to **PostgreSQL's default snapshot isolation**.

## 🔎 3. What Snapshot Isolation Means

- Each transaction works on a **snapshot** of data at its start
- Reads are consistent within that snapshot, even if other transactions commit in between
- If conflicting writes occur → loser aborts

## 🚀 4. Real-Life Example with Node.js + MongoDB

**Example:** Two people booking the same seat

**Collection:** `seats`

```javascript
{ "_id": 1, "seatNumber": "A1", "isBooked": false }
```

### Transaction A (Alice tries to book A1)

```javascript
const session1 = client.startSession();

await session1.withTransaction(async () => {
  const seat = await db.collection("seats").findOne(
    { seatNumber: "A1" },
    { session: session1 }
  );

  if (!seat.isBooked) {
    await db.collection("seats").updateOne(
      { seatNumber: "A1" },
      { $set: { isBooked: true, user: "Alice" } },
      { session: session1 }
    );
  }
});
```

### Transaction B (Bob tries to book A1 at the same time)

```javascript
const session2 = client.startSession();

await session2.withTransaction(async () => {
  const seat = await db.collection("seats").findOne(
    { seatNumber: "A1" },
    { session: session2 }
  );

  if (!seat.isBooked) {
    await db.collection("seats").updateOne(
      { seatNumber: "A1" },
      { $set: { isBooked: true, user: "Bob" } },
      { session: session2 }
    );
  }
});
```

## ⚡ What Happens

1. **Both read** the snapshot: `isBooked = false`
2. Alice commits first → succeeds
3. Bob commits after → MongoDB detects a **write conflict** because Alice already modified the same doc
4. Bob's transaction **aborts with** `WriteConflict` error

👉 Bob must retry his transaction. On retry, his snapshot shows `isBooked = true`, so he cannot book.

## 🎯 5. Interview-Safe Explanation

MongoDB provides **snapshot isolation** for transactions. Each transaction reads from a consistent snapshot of the database at its start. This prevents dirty reads and non-repeatable reads, but does not provide full serializable isolation, so phantom reads are possible.

In practice, if two concurrent transactions update the same document, MongoDB allows the first commit and aborts the second with a `WriteConflict`, which the application must handle by retrying. This ensures correctness while balancing performance in a distributed system.