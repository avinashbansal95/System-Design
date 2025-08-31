# MongoDB Phantom Reads Problem Guide

## 📌 Real-World Phantom Problem Example: **Overbooking**

Imagine we're running an **event ticketing system**. We want to **limit the total tickets sold to 100**.

**Collection:** `tickets`

```javascript
{ "_id": 1, "eventId": "concert1", "user": "Alice" }
{ "_id": 2, "eventId": "concert1", "user": "Bob" }
// ...
```

## 🎟 Transaction A — Alice buys a ticket

```javascript
await session1.withTransaction(async () => {
  const count = await db.collection("tickets")
    .countDocuments({ eventId: "concert1" }, { session: session1 });
  
  console.log("Alice sees count =", count); 
  // Suppose count = 99
  
  if (count < 100) {
    await db.collection("tickets").insertOne(
      { eventId: "concert1", user: "Alice" },
      { session: session1 }
    );
  }
});
```

## 🎟 Transaction B — Bob buys a ticket at the same time

```javascript
await session2.withTransaction(async () => {
  const count = await db.collection("tickets")
    .countDocuments({ eventId: "concert1" }, { session: session2 });
  
  console.log("Bob sees count =", count); 
  // He also sees count = 99 (same snapshot as Alice)
  
  if (count < 100) {
    await db.collection("tickets").insertOne(
      { eventId: "concert1", user: "Bob" },
      { session: session2 }
    );
  }
});
```

## ⚡ What Happens

1. Both Alice and Bob read the snapshot → `count = 99`
2. Both think they can safely insert
3. Both commit successfully → final count = **101 tickets sold** 😱

## ❌ The Phantom Problem

This is a **phantom read anomaly**:
- Both transactions saw the same snapshot of "tickets count = 99"
- Neither saw the other's insert
- Together they broke the invariant (`count ≤ 100`)

## ✅ What MySQL Would Do (Serializable Isolation)

In MySQL with `SERIALIZABLE` isolation:
- When the second transaction runs `SELECT COUNT(*)`, it would be blocked until the first finishes
- Or the second would fail with a serialization error, forcing a retry
- This prevents the overbooking problem

## 🎯 Interview-Safe Answer

MongoDB's snapshot isolation prevents dirty and non-repeatable reads, but it allows phantom reads. A real-world problem is **overbooking**: if two users both check how many tickets are sold (say 99 of 100), they both see 99 in their snapshot and insert new bookings, ending up with 101 tickets.

MySQL under SERIALIZABLE isolation would block or abort one transaction to prevent this invariant from breaking. In MongoDB, you must enforce such constraints at the application level, e.g., using:
- Unique indexes
- Application locks
- Redesigning schema to keep counters in a single document (which is always atomic)