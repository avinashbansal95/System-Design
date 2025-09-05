# The Saga Pattern: Modern Solution for Distributed Transactions

A comprehensive guide to implementing the Saga Pattern as a replacement for 2PC and 3PC in microservices architecture.

## Table of Contents

- [The Saga Pattern: Modern Solution for Distributed Transactions](#the-saga-pattern-modern-solution-for-distributed-transactions)
  - [Table of Contents](#table-of-contents)
  - [What is the Saga Pattern?](#what-is-the-saga-pattern)
  - [Two Types: Orchestrator vs Choreography](#two-types-orchestrator-vs-choreography)
    - [Orchestrator-Based](#orchestrator-based)
    - [Choreography-Based](#choreography-based)
  - [How Saga Solves Problems of 2PC/3PC](#how-saga-solves-problems-of-2pc3pc)
  - [Real-Life Example: E-Commerce Order Processing](#real-life-example-e-commerce-order-processing)
    - [Microservices Involved](#microservices-involved)
  - [Node.js + MySQL Implementation](#nodejs--mysql-implementation)
    - [1. OrderOrchestrator (Central Coordinator)](#1-orderorchestrator-central-coordinator)
    - [2. Inventory Service](#2-inventory-service)
    - [3. Payment Service](#3-payment-service)
    - [4. Order Service](#4-order-service)
  - [Handling Failures](#handling-failures)
    - [Scenario: Payment Fails After Inventory Reserved](#scenario-payment-fails-after-inventory-reserved)
  - [Pros \& Cons](#pros--cons)
    - [Pros of Saga (Orchestrator) Pattern](#pros-of-saga-orchestrator-pattern)
    - [Cons of Saga (Orchestrator)](#cons-of-saga-orchestrator)
  - [Saga vs 2PC/3PC Comparison](#saga-vs-2pc3pc-comparison)
  - [When to Use Saga](#when-to-use-saga)
    - [✅ Use Saga when:](#-use-saga-when)
    - [❌ Don't use Saga when:](#-dont-use-saga-when)
  - [Final Takeaway](#final-takeaway)

## What is the Saga Pattern?

A Saga is a sequence of local transactions where:

- Each service performs its own local transaction
- If one step fails, compensating (undo) transactions are triggered to reverse the previous steps

**Core idea**: Instead of blocking and waiting for consensus (like 2PC/3PC), Saga embraces eventual consistency.

## Two Types: Orchestrator vs Choreography

### Orchestrator-Based
A central **orchestrator** tells each service what to do.

### Choreography-Based  
Services communicate via **events** (no central controller).

*Note: This guide focuses on Orchestrator-Based Saga, as it's easier to understand and debug.*

## How Saga Solves Problems of 2PC/3PC

| Problem | 2PC/3PC | Saga Solution |
|---------|---------|---------------|
| **Blocking** | ❌ Services wait for consensus | ✅ Non-blocking – each step runs independently |
| **SPOF** | ❌ Single Point of Failure | ✅ Orchestrator can be replicated or persisted |
| **High Latency** | ❌ Waiting for all services to vote | ✅ No waiting for all services to vote |
| **Not Scalable** | ❌ Poor scalability | ✅ Scales well with async communication |
| **Database Locks** | ❌ Long-held locks | ✅ No long-held locks; uses compensating actions |
| **Unreliable in Cloud** | ❌ Fails with network issues | ✅ Works well with network partitions, retries, queues |

**Key Benefit**: Saga is eventually consistent, not strongly consistent — but practical for real-world systems.

## Real-Life Example: E-Commerce Order Processing

When a user places an order, we need to:

1. ✅ Create Order (Order Service)
2. ✅ Reserve Inventory (Inventory Service)  
3. ✅ Process Payment (Payment Service)

If any step fails, we must undo the previous ones using an **Orchestrator** (OrderOrchestrator).

### Microservices Involved

- **OrderService**: Create order, update status
- **InventoryService**: Reserve/Release stock
- **PaymentService**: Charge/Refund payment
- **OrderOrchestrator**: Coordinate the saga

Each has its own MySQL database.

## Node.js + MySQL Implementation

### 1. OrderOrchestrator (Central Coordinator)

```javascript
// orchestrator.js

class OrderOrchestrator {
  constructor() {
    this.state = {};
  }

  async executeSaga(orderData) {
    const { orderId, productId, userId, amount } = orderData;
    this.state.orderId = orderId;

    try {
      // Step 1: Create Order (always first, no need to compensate)
      await axios.post('http://order-service:3001/orders', {
        orderId,
        productId,
        userId,
        status: 'PENDING'
      });

      // Step 2: Reserve Inventory
      await axios.post('http://inventory-service:3002/reserve', {
        orderId,
        productId,
        quantity: 1
      });
      this.state.inventoryReserved = true;

      // Step 3: Process Payment
      await axios.post('http://payment-service:3003/process', {
        orderId,
        userId,
        amount
      });
      this.state.paymentProcessed = true;

      // ✅ All steps succeeded
      await axios.patch('http://order-service:3001/orders/' + orderId, {
        status: 'CONFIRMED'
      });

      return { success: true, orderId };

    } catch (err) {
      console.error('Saga failed:', err.message);
      // ❌ Trigger Compensating Transactions (Rollback in reverse order)
      await this.compensate(orderData);
      return { success: false, orderId };
    }
  }

  async compensate(orderData) {
    const { orderId, productId } = orderData;

    // Reverse order: Payment → Inventory → Order (optional)

    if (this.state.paymentProcessed) {
      try {
        await axios.post('http://payment-service:3003/refund', {
          orderId,
          reason: 'order_failed'
        });
      } catch (err) {
        console.error('Refund failed, retry later');
        // Queue for retry (e.g., Kafka, BullMQ)
      }
    }

    if (this.state.inventoryReserved) {
      try {
        await axios.post('http://inventory-service:3002/release', {
          orderId,
          productId,
          quantity: 1
        });
      } catch (err) {
        console.error('Inventory release failed');
      }
    }

    // Optionally: Mark order as FAILED
    await axios.patch('http://order-service:3001/orders/' + orderId, {
      status: 'FAILED'
    });
  }
}

// HTTP Endpoint
app.post('/order', async (req, res) => {
  const orchestrator = new OrderOrchestrator();
  const result = await orchestrator.executeSaga(req.body);
  res.json(result);
});
```

### 2. Inventory Service

```javascript
// inventoryService.js

app.post('/reserve', async (req, res) => {
  const { productId } = req.body;

  const product = await db.query(
    'SELECT * FROM products WHERE id = ? FOR UPDATE', [productId]
  );

  if (product.stock > 0) {
    await db.query('UPDATE products SET stock = stock - 1 WHERE id = ?', [productId]);
    await db.query('INSERT INTO inventory_reservations SET ?', {
      productId,
      orderId: req.body.orderId,
      createdAt: new Date()
    });
    res.status(200).json({ success: true });
  } else {
    res.status(400).json({ error: 'Out of stock' });
  }
});

app.post('/release', async (req, res) => {
  const { productId } = req.body;

  await db.query('UPDATE products SET stock = stock + 1 WHERE id = ?', [productId]);
  await db.query('DELETE FROM inventory_reservations WHERE productId = ? AND orderId = ?', 
    [productId, req.body.orderId]);

  res.json({ success: true });
});
```

### 3. Payment Service

```javascript
// paymentService.js

app.post('/process', async (req, res) => {
  const { amount, userId } = req.body;

  // Simulate external payment gateway
  const paymentResult = await chargePaymentGateway(userId, amount);

  if (paymentResult.success) {
    await db.query('INSERT INTO payments SET ?', {
      orderId: req.body.orderId,
      userId,
      amount,
      status: 'CHARGED'
    });
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Payment failed' });
  }
});

app.post('/refund', async (req, res) => {
  const { orderId } = req.body;

  const payment = await db.query('SELECT * FROM payments WHERE orderId = ?', [orderId]);
  if (payment) {
    await refundPaymentGateway(payment.transactionId);
    await db.query('UPDATE payments SET status = "REFUNDED" WHERE orderId = ?', [orderId]);
  }

  res.json({ success: true });
});
```

### 4. Order Service

```javascript
// orderService.js

app.post('/orders', async (req, res) => {
  await db.query('INSERT INTO orders SET ?', req.body);
  res.status(201).json({ orderId: req.body.orderId });
});

app.patch('/orders/:id', async (req, res) => {
  await db.query('UPDATE orders SET ? WHERE id = ?', [req.body, req.params.id]);
  res.json({ success: true });
});
```

## Handling Failures

### Scenario: Payment Fails After Inventory Reserved

1. ✅ Order created
2. ✅ Inventory reserved
3. ❌ Payment fails → exception thrown
4. 🔄 `compensate()` called:
   - Refund (noop, but safe)
   - Release inventory
   - Mark order as FAILED

**Result**: ✅ System is eventually consistent — no data corruption.

## Pros & Cons

### Pros of Saga (Orchestrator) Pattern

- **Non-Blocking**: Each step runs independently
- **No Locks**: No database row locks for long time
- **Fault-Tolerant**: Orchestrator can be persisted (e.g., in DB or queue)
- **Easy to Debug**: Central log of steps and decisions
- **Scalable**: Can use message queues (Kafka, RabbitMQ) for async steps
- **Cloud-Friendly**: Works with network delays, retries, partitions

### Cons of Saga (Orchestrator)

- **Eventual Consistency**: Not suitable for banking ledger (use strict consistency)
- **Complex Compensating Logic**: Design refund/release APIs carefully
- **Orchestrator as SPOF?**: Use persistent storage (e.g., save state in DB)
- **Long-Running**: Use timeouts and monitoring

## Saga vs 2PC/3PC Comparison

| Aspect | 2PC | 3PC | Saga |
|--------|-----|-----|------|
| **Blocking** | Yes | Partial | ❌ No |
| **Latency** | High | High | ✅ Low |
| **Fault Tolerance** | Poor | Medium | ✅ High |
| **Consistency** | Strong | Strong | Eventual |
| **Scalability** | Poor | Poor | ✅ High |
| **Real-World Use** | Legacy | Almost none | ✅ Widely used (Uber, Amazon, Netflix) |
| **Complexity** | Medium | High | Medium |
| **Recommended?** | ❌ No | ❌ No | ✅ **Yes** |

## When to Use Saga

### ✅ Use Saga when:
- You have microservices with separate DBs
- You need high availability & scalability
- You can tolerate eventual consistency

### ❌ Don't use Saga when:
- You need strong consistency (e.g., banking ledger)
- You're in a tightly coupled monolith (just use local DB transaction)

## Final Takeaway

- **2PC/3PC** = "Let's all agree before doing anything" → blocking, fragile
- **Saga** = "Do it step by step, and fix if it fails" → resilient, practical

The Saga pattern represents a modern, practical approach to handling distributed transactions in microservices architectures, providing the right balance between consistency and availability for most real-world applications.