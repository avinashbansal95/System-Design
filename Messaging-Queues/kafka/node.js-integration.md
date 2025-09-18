# Kafka Integration with Node.js - Complete Guide

## 1. Installation

First, install the required dependencies:

```bash
npm install kafkajs
# or
npm install node-rdkafka
```

I'll use the popular kafkajs library for this example.

## 2. Kafka Configuration

```javascript
// kafka-config.js
const { Kafka, Partitioners } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092'], // Replace with your Kafka broker addresses
  // For authentication (if needed):
  // ssl: true,
  // sasl: {
  //   mechanism: 'plain',
  //   username: 'username',
  //   password: 'password'
  // }
});

module.exports = { kafka, Partitioners };
```

## 3. Producer with Specific Partition

```javascript
// producer.js
const { kafka, Partitioners } = require('./kafka-config');

async function produceMessage() {
  const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner, // or DefaultPartitioner
  });

  await producer.connect();

  const topic = 'my-topic';
  const messages = [
    {
      value: JSON.stringify({ message: 'Hello Kafka!', timestamp: new Date() }),
      // Send to specific partition (partition 1)
      partition: 1,
      // Alternatively, use a key to determine partition
      // key: 'user-123', // Messages with same key go to same partition
    },
    {
      value: JSON.stringify({ message: 'Second message', timestamp: new Date() }),
      partition: 0, // Send to partition 0
    }
  ];

  try {
    const result = await producer.send({
      topic,
      messages,
    });

    console.log('Messages sent successfully:', result);
    console.log('Partition info:', result[0].partition);
    
  } catch (error) {
    console.error('Error sending message:', error);
  } finally {
    await producer.disconnect();
  }
}

// Run producer
produceMessage().catch(console.error);
```

## 4. Consumer for Specific Partition

```javascript
// consumer.js
const { kafka } = require('./kafka-config');

async function consumeMessages() {
  const consumer = kafka.consumer({
    groupId: 'my-consumer-group',
    // Optional: set partition assignment strategy
    // partitionAssignmentStrategy: 'RoundRobin'
  });

  await consumer.connect();
  
  const topic = 'my-topic';
  
  // Subscribe to specific partitions
  await consumer.subscribe({ 
    topic, 
    // Subscribe to specific partitions only
    fromBeginning: true // Start from earliest messages
  });

  // Alternatively, assign specific partitions manually
  // await consumer.subscribe({ topic: topic });
  // await consumer.assign([
  //   { topic: topic, partition: 0 },
  //   { topic: topic, partition: 1 }
  // ]);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log('Received message:', {
        topic,
        partition,
        offset: message.offset,
        value: message.value.toString(),
        key: message.key ? message.key.toString() : null,
        timestamp: message.timestamp,
      });

      // Process your message here
      try {
        const data = JSON.parse(message.value.toString());
        console.log('Parsed message data:', data);
      } catch (error) {
        console.log('Raw message:', message.value.toString());
      }
    },
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Disconnecting consumer...');
    await consumer.disconnect();
    process.exit(0);
  });
}

// Run consumer
consumeMessages().catch(console.error);
```

## 5. Advanced Consumer with Partition Control

```javascript
// advanced-consumer.js
const { kafka } = require('./kafka-config');

async function advancedConsumer() {
  const consumer = kafka.consumer({
    groupId: 'advanced-consumer-group',
  });

  await consumer.connect();

  // Manually assign specific partitions
  await consumer.assign([
    { topic: 'my-topic', partition: 1 }, // Only consume from partition 1
  ]);

  // Seek to specific offset if needed
  await consumer.seek({ topic: 'my-topic', partition: 1, offset: '0' });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`Partition ${partition}:`, {
        offset: message.offset,
        value: message.value.toString(),
      });
    },
  });
}

advancedConsumer().catch(console.error);
```

## 6. UI Tools to View Kafka Messages

Here are popular UI tools to visualize Kafka messages:

### Web-based UIs

- **Kafka Tool** - Desktop application with good UI
- **Kafdrop** - Web UI for Kafka (open source)
- **Kafka Manager** - Yahoo's web-based management tool
- **Conduktor** - Feature-rich web UI (free tier available)
- **Offset Explorer** (formerly Kafka Tool) - Desktop application

### Command Line Tools

```bash
# View messages in a topic
kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic my-topic --from-beginning

# View messages from specific partition
kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic my-topic --partition 1 --from-beginning

# View topic details
kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic my-topic
```

### Kafdrop Setup (Docker)

```bash
# Run Kafdrop with Docker
docker run -d --name kafdrop \
  -p 9000:9000 \
  -e KAFKA_BROKERCONNECT=localhost:9092 \
  -e JVM_OPTS="-Xms32M -Xmx64M" \
  obsidiandynamics/kafdrop:latest
```

Then access at: http://localhost:9000

## 7. Package.json Scripts

```json
{
  "scripts": {
    "produce": "node producer.js",
    "consume": "node consumer.js",
    "consume-partition": "node advanced-consumer.js"
  }
}
```

## Key Points

- **Partition Selection**: Use partition property or key for consistent partitioning
- **Consumer Groups**: Multiple consumers can work together in a group
- **Offset Management**: Kafka tracks which messages have been consumed
- **Error Handling**: Always implement proper error handling and cleanup
- **UI Monitoring**: Use tools like Kafdrop for real-time message viewing

This setup allows you to produce messages to specific partitions and consume from them while monitoring everything through UI tools.