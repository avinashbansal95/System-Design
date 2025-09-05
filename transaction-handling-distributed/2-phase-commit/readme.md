# Two-Phase Commit (2PC) Protocol: Complete Guide

## What is Two-Phase Commit (2PC)?

Two-Phase Commit (2PC) is a distributed algorithm that ensures atomicity of transactions across multiple nodes (or services) in a distributed system. It guarantees that all participating nodes either commit or abort a transaction together — maintaining consistency across services.

It's based on a coordinator and participants (cohorts) model.

## Steps of Two-Phase Commit (2PC)

There are two phases:

### 🟩 Phase 1: Voting (Prepare) Phase

1. **Coordinator** (e.g., Transaction Manager) sends a prepare message to all participants (microservices/databases)
2. Each participant:
   - Performs all local operations (writes to DB, locks resources)
   - Ensures it can commit the transaction
   - Replies with **Yes** (ready to commit) or **No** (must abort)
3. Coordinator waits for all votes

⚠️ **If any participant votes No, or times out, the coordinator decides to abort.**

### 🟥 Phase 2: Commit/Abort (Decision) Phase

**If all participants voted Yes:**
- Coordinator sends **commit** to all
- Each participant commits locally and replies with ack
- Coordinator completes the transaction

**If any participant voted No or times out:**
- Coordinator sends **abort** to all
- Each participant rolls back and replies with ack
- Transaction is canceled

The coordinator must log decisions to disk (for recovery in case of crash).

## 🔗 Key Roles

- **Coordinator**: Manages the transaction, sends prepare/commit/abort
- **Participants**: Execute local work, vote, and act on final decision

## 🌍 Real-Life Example: E-Commerce Order System

Let's imagine an e-commerce platform with 3 microservices:

- **Order Service** (Node.js + MySQL) – creates order
- **Inventory Service** (Node.js + MySQL) – checks and reduces stock
- **Payment Service** (Node.js + MySQL) – processes payment

You want to place an order, which must:
- Deduct inventory ✅
- Charge customer ✅
- Create order ✅

**All or nothing** — atomic across services.

We'll simulate 2PC with a Transaction Coordinator (could be in Order Service or a separate orchestrator).

### 🧱 Architecture Overview

```
[Client] 
   ↓
[Order Service] ←→ [Inventory Service]
   ↓                  ↓
[Payment Service] ←→ (MySQL DBs)
```

Each service has its own MySQL database.

## 🛠️ Step-by-Step Implementation (Simplified Node.js Pseudocode)

> **Note:** True 2PC requires XA Transactions or a transaction manager. We'll simulate it manually.

### 🔹 Step 1: Client Triggers Order

```javascript
// orderService.js
app.post('/order', async (req, res) => {
  const { productId, quantity, userId } = req.body;

  // Assume we have a coordinator logic here
  const coordinator = new TwoPCCoordinator();

  try {
    const success = await coordinator.executeTransaction({
      orderId: generateId(),
      productId,
      quantity,
      userId
    });

    if (success) {
      res.status(200).json({ message: "Order placed successfully" });
    } else {
      res.status(400).json({ message: "Order failed" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 🔹 Step 2: Coordinator Executes 2PC

```javascript
class TwoPCCoordinator {
  async executeTransaction(data) {
    const { orderId, productId, quantity, userId } = data;

    const participants = [
      { name: 'InventoryService', url: 'http://inventory:3001' },
      { name: 'PaymentService',  url: 'http://payment:3002' }
    ];

    // Phase 1: Prepare
    const votes = [];
    for (const participant of participants) {
      try {
        const response = await axios.post(`${participant.url}/prepare`, {
          orderId,
          productId,
          quantity,
          userId
        }, { timeout: 5000 });

        votes.push(response.data.vote === 'YES');
      } catch (err) {
        votes.push(false);
      }
    }

    // If all vote YES → commit, else → abort
    const allAgreed = votes.every(vote => vote);

    // Phase 2: Decide
    const decision = allAgreed ? 'COMMIT' : 'ABORT';

    for (const participant of participants) {
      try {
        await axios.post(`${participant.url}/decision`, {
          orderId,
          decision
        });
      } catch (err) {
        console.error(`Failed to send ${decision} to ${participant.name}`);
        return false;
      }
    }

    // Only create order if COMMIT
    if (allAgreed) {
      await db.query('INSERT INTO orders SET ?', { orderId, productId, userId, status: 'confirmed' });
    }

    return allAgreed;
  }
}
```

### 🔹 Step 3: Inventory Service Prepare & Commit

```javascript
// inventoryService.js
app.post('/prepare', async (req, res) => {
  const { productId, quantity } = req.body;

  const product = await db.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [productId]);

  if (product.stock >= quantity) {
    // Temporarily lock or log intent
    await logPrepareDecision(productId, quantity, 'YES');
    res.json({ vote: 'YES' });
  } else {
    res.json({ vote: 'NO' });
  }
});

app.post('/decision', async (req, res) => {
  const { orderId, decision } = req.body;

  if (decision === 'COMMIT') {
    // Finalize inventory deduction
    await db.query('UPDATE products SET stock = stock - ? WHERE id = ?', [quantity, productId]);
    await logTransaction(orderId, 'COMMITTED');
  } else {
    // Release locks or do nothing
    await logTransaction(orderId, 'ABORTED');
  }

  res.json({ status: 'ACK' });
});
```

Payment Service would follow similar logic (e.g., reserve funds on prepare, charge on commit).

## ⚠️ Cons of Two-Phase Commit

| Problem | Description |
|---------|-------------|
| **Blocking Protocol** | If coordinator fails during phase 2, participants may **block indefinitely** waiting for decision |
| **Single Point of Failure** | Coordinator failure can **hang** the system |
| **Performance Overhead** | Synchronous, multiple round trips → **latency** |
| **Not Scalable** | Hard to scale with many services or high throughput |
| **Database Support Required** | Requires **XA Transactions** support (not all databases or ORMs handle this well) |
| **Complex Recovery** | Needs persistent logs to recover after crashes |
| **Deadlocks & Timeouts** | Risk of deadlocks due to resource locking during **prepare** |

## ✅ Pros of 2PC

- **Strong Consistency**: Guarantees ACID across services
- **Atomicity**: All or nothing — no partial updates
- **Well-Understood**: Classic algorithm with known behavior

## 🤔 Is 2PC Recommended Today?

❌ **Generally NOT recommended** for modern microservices architectures.

✔️ **But it's good to know because:**
- It teaches core concepts of distributed transactions
- Still used in legacy systems, banking, or strongly consistent databases
- Helps understand why alternatives like Sagas, eventual consistency, or outbox pattern exist

## 🔄 Modern Alternatives to 2PC

| Pattern | Use Case |
|---------|----------|
| **Saga Pattern** | Long-running transactions, e.g., order processing |
| **Event-Driven Architecture** | Use events (Kafka, RabbitMQ) to coordinate |
| **Compensating Transactions** | Undo actions if part fails |
| **TCC (Try-Confirm-Cancel)** | Non-blocking, business-level 2PC |
| **Outbox Pattern + CDC** | Reliable message publishing from DB |

These are non-blocking, fault-tolerant, and scalable.

## ✅ Summary

| Aspect | Details |
|--------|---------|
| **2PC Purpose** | Ensure atomic commits across distributed services |
| **Phases** | Prepare (vote), Commit/Abort (decide) |
| **Roles** | Coordinator + Participants |
| **Use Case Example** | E-commerce order, inventory, payment |
| **Tech Used** | Node.js, MySQL, HTTP APIs |
| **Pros** | Strong consistency, atomicity |
| **Cons** | Blocking, SPOF, slow, hard to scale |
| **Recommended?** | ❌ Not for new microservices; ✅ Good to understand |

## 📚 Final Advice

- **Know 2PC** to understand distributed systems history and trade-offs
- **Use Sagas or Event-Driven patterns** in real-world microservices