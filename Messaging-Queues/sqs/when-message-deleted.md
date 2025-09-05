# Message Deletion Behavior: Kafka vs Pub/Sub vs SQS

## 1. Kafka

### Storage model
Kafka is a **commit log**, not a queue. Messages are never "deleted" when consumed. They stay in the partition log until retention expires.

### When does a message disappear?

- **Never on ACK** — consumer ACK (offset commit) does **not** delete the message
- Message is deleted only after:
  - **Time-based retention** (e.g., 7 days → `retention.ms`), or
  - **Size-based retention** (`retention.bytes`), or
  - **Compaction** (keeps only last message per key if log compaction enabled)

### Consumer tracking

- Consumers track their **offset** (last processed position)
- If offset committed = 42, the consumer will start from 43 next time
- Old messages (0–42) may still exist in Kafka, available for replay

✅ **Summary:** In Kafka, messages are deleted by retention policy, **not by acknowledgement**. Consumers control their read position (offset).

## 2. Google Cloud Pub/Sub

### Storage model
Topic delivers to **subscriptions**. Each subscription has its own pending messages.

### When does a message disappear?

For a given subscription:
- Message is removed from subscription **once subscriber ACKs it**
- If the subscriber doesn't ACK within **ackDeadlineSeconds** (default 10s, extendable), Pub/Sub will redeliver the message

### Ordering note
If ordering keys enabled, Pub/Sub will hold back later messages for that key until earlier message is ACKed.

### Retention
- If a message is never ACKed, Pub/Sub retains it for **7 days** by default, then deletes it
- Once ACKed → removed immediately from that subscription (but still available to other subscriptions if they exist)

✅ **Summary:** In Pub/Sub, a message is deleted from a subscription **on ACK**. If no ACK, it's redelivered until retention expires.

## 3. AWS SQS

### Storage model
Queue (Standard or FIFO).

### When does a message disappear?

- A consumer calls `ReceiveMessage` → message is hidden (invisible) for the **VisibilityTimeout** (default 30s)
- If consumer **deletes** the message (via `DeleteMessage` API), it is permanently removed
- If consumer does not delete it before timeout, it becomes visible again → redelivered

### Difference vs Pub/Sub
- In Pub/Sub, ACK = deletion
- In SQS, **you must explicitly delete** after processing. Merely receiving does not delete

### Retention
Messages kept in queue for up to **14 days** if not deleted.

✅ **Summary:** In SQS, a message is deleted **only when consumer explicitly calls** `DeleteMessage` after processing. Until then, it's either invisible (during visibility timeout) or reappears for redelivery.

## 🔑 Side-by-Side Summary

| System | When message is deleted/removed? |
|--------|----------------------------------|
| **Kafka** | Never on ACK. Deleted only by retention (time, size, or compaction). ACK (offset commit) just advances consumer's read pointer. |
| **Pub/Sub** | On **ACK**. If not ACKed, redelivered until retention expires (7 days). |
| **SQS** | Only on explicit **DeleteMessage** API call. ReceiveMessage just hides it temporarily (visibility timeout). |

## Real-life Analogy

- **Kafka:** Like a CCTV recorder. It keeps all footage for 7 days regardless of whether you've watched it. Your "last watched time" is just a bookmark.

- **Pub/Sub:** Like Gmail inbox. Once you mark an email as "done" (ACK), it disappears from the inbox.

- **SQS:** Like a task board. You "take" a task (message), it disappears temporarily (visibility timeout). Only when you click "done" (DeleteMessage) is it really gone.