# SERIALIZABLE Example (Alternative Approach)

## 📌 SERIALIZABLE Example (Alternative Approach)

If you want **range queries** (like "book any free seat") without phantoms:

```javascript
async function serializableBookingExample(conn, userId) {
  console.log("\n=== SERIALIZABLE Example ===");

  await conn.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
  await conn.beginTransaction();

  try {
    // Step 1: Find and lock the first free seat
    const [rows] = await conn.query(
      "SELECT id FROM seats WHERE status = 'free' LIMIT 1 FOR UPDATE"
    );

    if (rows.length === 0) {
      throw new Error("No free seats available");
    }
    const seatId = rows[0].id;

    // Step 2: Mark it booked
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

👉 In **SERIALIZABLE**, MySQL prevents phantoms — if multiple users try to grab "any free seat," only one transaction wins; the others block.

## 📌 Key Takeaways

* **Just REPEATABLE READ** (snapshot isolation) is **not enough** for bookings → can still overbook.
* Use `SELECT … FOR UPDATE` inside a transaction to **lock rows**.
* For range queries (e.g., "any free seat"), use **SERIALIZABLE** isolation to avoid phantoms.