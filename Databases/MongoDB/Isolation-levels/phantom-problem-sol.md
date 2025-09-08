# How MySQL Solves the Ticket Booking Problem with SERIALIZABLE Isolation

## 🔐 Transaction Isolation in MySQL

MySQL supports multiple **transaction isolation levels**, including `SERIALIZABLE` — the strongest level, which ensures complete isolation between concurrent transactions.

At the `SERIALIZABLE` level:
- All reads are performed with **range locking**.
- Any `SELECT` within a transaction behaves as if it places locks on the rows it reads — and even on gaps where new rows could be inserted.
- This prevents **phantom reads** (new rows appearing during a transaction).
- It ensures data consistency and enforces business rules (e.g., max 100 tickets).

> ✅ **Result**: Prevents overbooking by serializing access to critical sections.

---

## 🛠️ Example: Ticket Booking System

### Database Schema

```sql
CREATE TABLE tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(50),
  user VARCHAR(50)
);