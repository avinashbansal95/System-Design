# Google Cloud Pub/Sub Delivery Semantics: Complete Guide

Perfect — let's take the same deep dive you asked for Kafka, but now for Google Cloud Pub/Sub.

I'll cover:
- What delivery guarantees Pub/Sub supports
- How it achieves them (publisher + subscriber behavior)
- What the default is
- How multiple subscriber clients coordinate (N groups × M consumers)
- Real-life examples for at-most-once, at-least-once, exactly-once
- How to enable/configure each

## 1. Delivery Semantics in GCP Pub/Sub

**Pub/Sub offers at-least-once delivery by default.**
- A message is delivered one or more times until it's ACKed.
- You may see duplicates.

**Pub/Sub does not natively support "at-most-once"** — but you can simulate it in your subscriber logic.

**Since 2021+, Pub/Sub also offers exactly-once delivery (EOD) as an optional feature** (subscription-level).
- Ensures a message is delivered only once if acknowledged within its ack deadline.
- Still requires you to use idempotent consumers to handle retries in case of errors.

## 2. How Each Semantic is Achieved

### 2.1 At-most-once (not native, simulated)

- Subscriber acknowledges the message immediately upon receipt (before processing).
- If subscriber crashes right after ack but before processing, message is lost.
- No duplicates, but possible loss.
- You build this behavior in code.

👉 **Example:** Logging system where you don't care if some log lines are lost, but don't want duplicates cluttering dashboards.

### 2.2 At-least-once (default)

- Pub/Sub redelivers messages until subscriber sends ACK.
- If subscriber crashes after processing but before ACK, message will be redelivered → duplicate.
- Guarantees "eventually delivered at least once".

👉 **Example:** E-commerce order event. If the system inserts a duplicate order row, backend can deduplicate via orderId. Losing an order is unacceptable.

### 2.3 Exactly-once (opt-in feature)

- Enable exactly-once delivery when creating the subscription.
- Pub/Sub ensures each published message is delivered once and only once to each subscriber client, provided the subscriber sends an ACK.
- Requires using `--enable-exactly-once-delivery` (CLI) or setting `enable_exactly_once_delivery=true` in API/console.
- Still best practice: consumers should be idempotent, because if your handler crashes mid-way before ACK, the message can be resent — but Pub/Sub ensures no duplicates once ACK succeeds.

👉 **Example:** Banking transfers. Deduct ₹1000 from account A, credit account B. You must not double debit/credit, so exactly-once prevents both duplicates and loss.

## 3. Default Behavior in Pub/Sub

- **At-least-once delivery is default.**
- **Exactly-once must be explicitly enabled** on subscription creation.
- **At-most-once is only simulated** (ack before processing).

## 4. Coordination with Multiple Subscribers (N groups × M consumers)

In Pub/Sub, there isn't a concept of Kafka-style consumer groups that balance partitions. Instead:

### Subscription = delivery group
- Every subscription attached to a topic gets a full copy of each message.
- If you have N subscriptions, Pub/Sub delivers N copies (independent from each other).

### M subscribers per subscription
- You can run multiple subscriber clients on the same subscription.
- Pub/Sub load balances messages across them automatically.
- Ordering is not guaranteed across multiple subscribers unless you use ordering keys and ensure only one subscriber processes that ordering key at a time.

**So:**
- **Kafka** → partitions + group coordinator.
- **Pub/Sub** → subscription acts as the group, backend manages load balancing.

## 5. Real-life Examples

### At-most-once (simulated)
- **Scenario:** IoT sensor reporting room temperature every second.
- If one reading is lost, that's fine.
- Subscriber acks immediately, then processes.

### At-least-once (default)
- **Scenario:** Email notification service.
- Duplicates → user might get two emails (can be handled with deduplication key).
- But you never want to lose the notification.
- Subscriber processes, then ACKs.

### Exactly-once
- **Scenario:** Bank ledger update.
- Double credit/debit must not happen.
- Enable exactly-once delivery subscription.
- Subscriber processes, then ACKs only after success.

## 6. How to Enable / Configure

### Create subscription with exactly-once

#### Console
1. Go to Pub/Sub → Create Subscription.
2. Check "Enable exactly-once delivery".

#### gcloud CLI
```bash
gcloud pubsub subscriptions create my-sub \
  --topic=my-topic \
  --enable-exactly-once-delivery
```

#### REST/JSON
```json
{
  "name": "projects/my-proj/subscriptions/my-sub",
  "topic": "projects/my-proj/topics/my-topic",
  "enableExactlyOnceDelivery": true
}
```

## 7. Subscriber Code Logic (Node.js Example)

### At-most-once
```javascript
const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();

const sub = pubsub.subscription('my-sub');
sub.on('message', message => {
  // 1) Ack immediately
  message.ack();

  // 2) Then process
  console.log('At-most-once:', message.data.toString());
});
```

### At-least-once (default)
```javascript
sub.on('message', async message => {
  try {
    // 1) Process first
    console.log('At-least-once:', message.data.toString());

    // 2) Ack after successful processing
    message.ack();
  } catch (err) {
    console.error('Failed, message will be redelivered:', err);
    // do not ack -> redelivery occurs
  }
});
```

### Exactly-once (with enabled subscription)
```javascript
sub.on('message', async message => {
  try {
    // process (write to DB, etc.)
    console.log('Exactly-once:', message.data.toString());

    // ack after success
    message.ack();  // Pub/Sub ensures no duplicates after ack
  } catch (err) {
    // Nack or let ack deadline expire → Pub/Sub will retry
    message.nack();
  }
});
```

## ✅ Summary (Interview-ready)

- **Pub/Sub's default = at-least-once** (like Kafka).
- **At-most-once possible** by acking before processing (simulated).
- **Exactly-once is an opt-in subscription feature** (`--enable-exactly-once-delivery`).
- **Multiple subscribers per subscription** = Pub/Sub balances messages. **Multiple subscriptions** = each gets a full copy.
- **Real-world examples:** logs (at-most-once), e-commerce orders (at-least-once), payments (exactly-once).