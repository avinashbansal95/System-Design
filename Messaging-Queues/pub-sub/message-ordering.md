# Google Cloud Pub/Sub Message Ordering Guide

## Short Answer Up Front

- **Pub/Sub is not partitioned like Kafka.** It doesn't expose partitions you manage; instead it offers an **ordering key** feature that gives ordered delivery **per ordering key** (not a single global ordered queue).
- **Ordering is not global** — it's scoped to the ordering key. Messages with the same ordering key are guaranteed to be delivered in publish order (subject to the behaviors described below); messages with different ordering keys may be interleaved.
- To get ordered delivery you must **(a)** enable message ordering on the subscription and **(b)** publish messages with an ordering key. If ordering isn't enabled or you don't set keys, Pub/Sub does not guarantee order.

## Clarify: "Pub/Sub is not partitioned — do they have one queue?"

- Pub/Sub topics are a logical stream; **they're not partitioned in the user-visible Kafka sense** (you don't create partitions). Instead, Pub/Sub internally shards and scales — but you don't control partition count.
- Conceptually: a **topic** + one or more **subscriptions** (push or pull). Subscriptions receive copies of messages. Ordering is controlled **per subscription** by enabling the subscription's "message ordering" feature.

## How Ordering Works (Mechanics, Simply)

1. **Publish with an ordering key** (e.g., `orderingKey = "account-12345"`). All messages published with that key are considered one ordered stream.

2. **Enable message ordering on the subscription**. The subscription will then attempt to deliver messages with the same ordering key **in publish order**. If a message with that key is not acknowledged (or fails), Pub/Sub **holds** subsequent messages with the same key until the earlier message is ACKed (this preserves order).

3. **If you don't set an ordering key**, messages are not ordered relative to each other (default behavior).

### Important Practical Notes:

- Ordering is per ordering key and per subscription — it is **not** a single global ordered queue across keys.
- If an ordering-key message is NACKed or times out, Pub/Sub may redeliver that message and will also delay delivery of subsequent messages with the same ordering key until ordering is restored (so ordering comes at a potential throughput/latency cost).

## Banking Example (Walkthrough)

**Scenario:** Customer `account-12345` publishes 3 events in this order:
1. `Deposit ₹1000` (orderingKey = `account-12345`)
2. `Withdraw ₹500` (same orderingKey)
3. `Withdraw ₹300` (same orderingKey)

### Without ordering key / ordering disabled
- Messages may be delivered out of order to the subscriber(s). Withdraw might be processed before Deposit → **wrong behavior** for account balance. Pub/Sub *does not* guarantee order unless you use ordering keys and enable ordering.

### With ordering enabled and publishing with orderingKey=`account-12345`
- Pub/Sub guarantees the **subscriber** receives these three events in exact publish order: Deposit → Withdraw ₹500 → Withdraw ₹300.
- If the subscriber processing `Withdraw ₹500` fails and does not ACK, Pub/Sub will hold/delay the `Withdraw ₹300` message with the same key until the earlier one is ACKed (this preserves order but may reduce parallelism for that key).

## Parallelism Considerations

- Messages for **different accounts** (different ordering keys) can be delivered and processed in parallel. So you get ordered delivery per account while retaining concurrency across accounts.

## How to Enable Ordering (Step-by-Step)

### A. Console (Quick)

1. Go to **Google Cloud Console → Pub/Sub → Subscriptions**.
2. Click **Create subscription** (or edit an existing subscription).
3. In **Message ordering**, check **Order messages with an ordering key** (or similar wording).
4. Create the subscription.

**Note:** You cannot change the message ordering property after you create a subscription — set it at creation time.