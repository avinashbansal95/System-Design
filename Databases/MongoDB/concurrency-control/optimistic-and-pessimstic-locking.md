# MongoDB: Optimistic vs Pessimistic Locking with Node.js

## 📌 1. What They Are

### 🔑 Pessimistic Locking

* Assumes conflicts are likely.
* So when a client wants to modify a record, it locks it immediately (others must wait).
* Common in RDBMS (`SELECT … FOR UPDATE`).
* Ensures no conflicts but reduces concurrency.

👉 **Analogy**: Borrowing a library book, you put your name on the book so nobody else can even touch it while you're reading.

### 🔑 Optimistic Locking

* Assumes conflicts are rare.
* No locks are taken at read time.
* Instead, each record has a version field (or timestamp).
* On update, you check if version hasn't changed since you read it.
* If version changed → conflict → retry.

👉 **Analogy**: Borrowing a book without telling anyone, but when you return it, you check if someone else already updated the same notes. If yes, you redo your work.

## 📌 2. MongoDB & Locking

* MongoDB does not have row-level locks like MySQL's `FOR UPDATE`.
* By default, MongoDB uses optimistic concurrency control via the `findAndModify` / `$where` version pattern.
* But you can simulate pessimistic locking using a lock flag field (`isLocked`) or distributed lock with Redis/Zookeeper.

## 📌 3. Optimistic Locking in Node.js + MongoDB

Suppose we have a seats collection:

```json
{
  "_id": 1,
  "status": "free",
  "version": 1
}
```

### Node.js Example

```javascript
const { MongoClient } = require("mongodb");

async function optimisticBooking(db, seatId, userId) {
  const seats = db.collection("seats");

  // Step 1: Read seat
  const seat = await seats.findOne({ _id: seatId });
  if (!seat || seat.status !== "free") {
    throw new Error("Seat not available");
  }

  // Step 2: Try to update with version check
  const result = await seats.updateOne(
    { _id: seatId, version: seat.version, status: "free" },
    { $set: { status: "booked", userId, version: seat.version + 1 } }
  );

  if (result.matchedCount === 0) {
    throw new Error("Conflict detected: seat already booked by another user");
  }

  console.log(`✅ Seat ${seatId} booked by user ${userId}`);
}
```

👉 **Here**:
* We rely on the `version` field.
* If another transaction updated the seat in the meantime, the version won't match → update fails → conflict.
* This is optimistic locking.

## 📌 4. Pessimistic Locking in Node.js + MongoDB

* MongoDB doesn't have built-in `SELECT … FOR UPDATE`.
* But you can simulate pessimistic locking by adding a lock flag.

### Example

```javascript
async function pessimisticBooking(db, seatId, userId) {
  const seats = db.collection("seats");

  // Step 1: Try to lock the seat
  const seat = await seats.findOneAndUpdate(
    { _id: seatId, status: "free", isLocked: { $ne: true } },
    { $set: { isLocked: true, lockedBy: userId } },
    { returnDocument: "after" }
  );

  if (!seat.value) {
    throw new Error("Seat already locked or booked");
  }

  // Step 2: Perform booking
  const result = await seats.updateOne(
    { _id: seatId, isLocked: true, lockedBy: userId },
    { $set: { status: "booked", userId }, $unset: { isLocked: "", lockedBy: "" } }
  );

  if (result.modifiedCount === 0) {
    throw new Error("Booking failed");
  }

  console.log(`✅ Seat ${seatId} booked by user ${userId}`);
}
```

👉 **Here**:
* We explicitly set `isLocked: true` before booking.
* Other users trying to book will fail immediately.
* Once booking is done, we remove the lock.
* This mimics pessimistic locking.

## 📌 5. When to Use

### Optimistic Locking
* Best when conflicts are rare.
* High throughput, no blocking.
* Common for MongoDB use cases.

### Pessimistic Locking
* Best when conflicts are frequent or business-critical (like seat booking, payments).
* Ensures only one transaction works on a resource at a time.
* Costs extra (manual lock handling or distributed lock service).

## 🎯 Interview-Safe Answer

Optimistic locking in MongoDB is usually implemented by adding a version field or using conditional updates (`updateOne` with a version match). It assumes conflicts are rare, and if a conflict happens the transaction retries. Pessimistic locking is simulated in MongoDB by marking a document as locked (`isLocked=true`) before updating, which blocks other writers until the lock is released. Optimistic locking gives better concurrency but may require retries, while pessimistic locking avoids conflicts at the cost of reduced concurrency.