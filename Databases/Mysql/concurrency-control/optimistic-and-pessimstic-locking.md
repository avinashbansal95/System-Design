# MySQL: Optimistic vs Pessimistic Locking with Node.js

Perfect 👌 — let's now see Optimistic vs Pessimistic locking in MySQL using Node.js (mysql2/promise).

We'll use the same seat booking example as with MongoDB so you can compare.

## 📌 1. Pessimistic Locking in MySQL

* Classic RDBMS approach.
* Achieved with `SELECT … FOR UPDATE`.
* Locks the row immediately → other transactions trying to lock the same row must wait until the first transaction commits/rolls back.
* Ensures correctness but reduces concurrency.

### Node.js Example

```javascript
const mysql = require("mysql2/promise");

async function pessimisticBooking(conn, seatId, userId) {
  try {
    await conn.beginTransaction();

    // Step 1: Lock the row (pessimistic lock)
    const [rows] = await conn.query(
      "SELECT status FROM seats WHERE id=? FOR UPDATE",
      [seatId]
    );

    if (rows.length === 0) throw new Error("Seat not found");
    if (rows[0].status !== "free") throw new Error("Seat already booked");

    // Step 2: Update the seat
    await conn.query(
      "UPDATE seats SET status='booked', user_id=? WHERE id=?",
      [userId, seatId]
    );

    await conn.commit();
    console.log(`✅ Seat ${seatId} booked for user ${userId}`);
  } catch (err) {
    await conn.rollback();
    console.error("❌ Booking failed:", err.message);
  }
}
```

👉 **Here**:
* First transaction locks the seat row.
* Second transaction trying the same seat will wait until the lock is released.
* Prevents double booking.

## 📌 2. Optimistic Locking in MySQL

* Achieved by adding a version column (or timestamp).
* No locks taken when reading.
* At update time → check version hasn't changed.
* If it changed → conflict → retry.

### Schema Change

```sql
ALTER TABLE seats ADD COLUMN version INT DEFAULT 1;
```

### Node.js Example

```javascript
async function optimisticBooking(conn, seatId, userId) {
  try {
    await conn.beginTransaction();

    // Step 1: Read seat with version
    const [rows] = await conn.query("SELECT status, version FROM seats WHERE id=?", [seatId]);
    if (rows.length === 0) throw new Error("Seat not found");
    if (rows[0].status !== "free") throw new Error("Seat already booked");

    const currentVersion = rows[0].version;

    // Step 2: Update seat only if version matches
    const [result] = await conn.query(
      "UPDATE seats SET status='booked', user_id=?, version=version+1 WHERE id=? AND version=?",
      [userId, seatId, currentVersion]
    );

    if (result.affectedRows === 0) {
      throw new Error("Conflict detected: seat was already booked by someone else");
    }

    await conn.commit();
    console.log(`✅ Seat ${seatId} booked for user ${userId}`);
  } catch (err) {
    await conn.rollback();
    console.error("❌ Booking failed:", err.message);
  }
}
```

👉 **Here**:
* If two users read the same seat at the same time, both will try to book.
* Only one update succeeds (because version still matches).
* The other fails (affectedRows=0) → app must retry or report conflict.

## 📌 3. Key Differences (MySQL)

| Approach | How it Works | Pros | Cons |
|----------|-------------|------|------|
| Pessimistic Locking (`FOR UPDATE`) | Locks row until commit | Strong consistency, no retries | Can cause blocking, lower concurrency |
| Optimistic Locking (version check) | No lock; update checks version | High concurrency, no waiting | If conflicts happen, app must retry |

## 📌 4. Comparison to MongoDB

* **MongoDB** has no row locks, so you typically use Optimistic Locking (version field) or simulate locks in app.
* **MySQL** naturally supports Pessimistic Locking (`FOR UPDATE`), and Optimistic Locking can be added with a version column.

## 🎯 Interview-Safe Answer

In MySQL with Node.js, pessimistic locking is implemented using `SELECT … FOR UPDATE` inside a transaction, which locks the row until commit. This ensures only one transaction can book a seat at a time, but other transactions wait. Optimistic locking is implemented by adding a version column: read the seat with its version, then update only if the version matches. If another transaction updated it first, the update fails and the app retries. Pessimistic locking guarantees consistency with blocking, while optimistic locking gives better concurrency but requires retry handling.