# Correct Seat Booking: REPEATABLE READ + Row Locking

* Just using **REPEATABLE READ** snapshot isolation is **not enough** for things like seat booking.
* You need to use **locking reads** (`SELECT … FOR UPDATE`) so that concurrent transactions don't both think the seat is available.

Let me rewrite your **Node.js example** to show the correct way 👇

## 📌 Correct: REPEATABLE READ + Row Locking

```javascript
async function repeatableReadBookingExample(conn, seatId, userId) {
  console.log("\n=== REPEATABLE READ with Locking Example ===");

  // Set explicit isolation (optional since MySQL default is REPEATABLE READ)
  await conn.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await conn.beginTransaction();

  try {
    // Step 1: Lock the seat row
    const [rows] = await conn.query(
      "SELECT status FROM seats WHERE id = ? FOR UPDATE",
      [seatId]
    );

    if (rows.length === 0) {
      throw new Error("Seat not found");
    }
    if (rows[0].status !== 'free') {
      throw new Error("Seat already booked");
    }

    // Step 2: Mark seat as booked
    await conn.query(
      "UPDATE seats SET status = 'booked', user_id = ? WHERE id = ?",
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

## 📌 Why This Works

* `SELECT … FOR UPDATE` acquires a **row-level lock** on the seat.
* If two users try to book the same seat:
  * Transaction A locks the row first.
  * Transaction B must **wait** until A commits/rolls back.
  * Once A commits, B re-checks and sees seat already booked → booking fails gracefully.
* Prevents **double booking** ✅