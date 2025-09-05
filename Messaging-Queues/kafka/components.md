# Kafka Core Concepts Reference

## Broker
A Kafka server that stores data and serves clients. Brokers form a cluster; each broker is responsible for some partitions of topics. Handles reads/writes, replication, leader/follower roles.

## Topic
A named stream of records. Logical grouping. Topics are split into **partitions**.

## Partition
An ordered, immutable sequence of messages appended to a commit log. Partitions are the unit of parallelism and ordering. Each partition has one leader and zero-or-more followers (replicas).

## Producer
Client that publishes records to topics. Controls batching, compression, acks, retries, idempotence, transactions.

## Consumer
Client that reads records. Two modes:
- Simple consumer (manual offset management)
- Group consumer (part of a **consumer group** for load balancing)

## Consumer Group
Set of consumers that coordinate to read a topic's partitions. Each partition is consumed by exactly one consumer in the group (so messages are load-balanced within a group).

## Controller
Component that manages partition leader election, cluster metadata. Traditionally one broker acts as controller. Zookeeper handled this earlier; newer Kafka uses **KRaft** (Kafka Raft) mode to remove Zookeeper.

## ZooKeeper / KRaft
- **ZooKeeper**: older metadata store (cluster membership, controller election). Deprecated in favor of KRaft.
- **KRaft (Kafka Raft)**: built-in metadata quorum replacing ZooKeeper in newer Kafka versions.

## Replication / ISR (In-Sync Replicas)
Each partition has N replicas (replication.factor). The leader handles reads/writes; followers replicate. ISR is the set of replicas considered up-to-date; only ISR replicas are eligible to become leader.

## Offset
A per-partition sequential id for each record. Consumers commit offsets to mark progress (either in Kafka's internal __consumer_offsets topic or externally).

## Log Segment & Retention
Each partition is stored as segments on disk. Kafka has retention policies:
- Time-based retention (e.g., 7 days)
- Size-based retention
- Log compaction (keeps latest message per key, useful for changelogs)

## Schema Registry (optional in ecosystem)
Stores Avro/JSON/Protobuf schemas; enforces compatibility. Important when messages evolve.

## Kafka Connect
Framework to move data into/out of Kafka (connectors for DBs, S3, etc).

## Kafka Streams / ksqlDB
Libraries for stream processing (stateful ops, windows, joins, aggregations).