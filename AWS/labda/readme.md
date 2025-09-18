# AWS Lambda Complete Guide

## What is AWS Lambda?

AWS Lambda is a serverless compute service that lets you run code without provisioning or managing servers. You simply upload your code (as a "Lambda function") and Lambda takes care of everything required to run and scale it with high availability.

You are charged only for the compute time you consume—there is no charge when your code is not running.

## When to Use and Why to Use?

### When to Use Lambda

- **Event-Driven Applications**: Respond to events from other AWS services (e.g., process an image after it's uploaded to S3, update a database after a new item is added to a stream).

- **Real-time File Processing**: Process files as soon as they are uploaded to S3 (e.g., generating thumbnails, validating content, transcoding videos).

- **Real-time Stream Processing**: Process data streams from Kinesis or DynamoDB Streams (e.g., for analytics, aggregation, or loading into a data warehouse).

- **Backends for APIs**: Build RESTful APIs using Lambda and API Gateway (so-called "serverless backends").

- **Scheduled Tasks (Cron Jobs)**: Run functions on a schedule using Amazon EventBridge (e.g., periodic health checks, data cleanup, report generation).

- **Automation of AWS Infrastructure**: Automate tasks like cleaning up unused resources, enforcing tagging policies, or responding to security events.

### Why to Use Lambda (The Key Benefits)

- **No Server Management**: You don't have to worry about OS patches, security patches, scaling, or server capacity.

- **Automatic Scaling**: Lambda scales your function automatically by running more instances in response to incoming events. Scaling is seamless and built-in.

- **Pay-Per-Use Model**: You pay only for the number of requests and the compute time (rounded to the nearest 1ms). This can be vastly more cost-effective than paying for always-on servers.

- **High Availability**: Lambda runs your function in multiple Availability Centers by default, making your application highly available and fault-tolerant.

## Instances, Scaling, and Concurrency

### What is a "Default Instance"?

The term "instance" in Lambda is a bit abstract. Think of it as an execution environment. When an event triggers your Lambda function, Lambda launches an execution environment to run your function code. This environment includes your code, its dependencies, and the runtime (e.g., Python, Node.js).

There is no concept of a "default instance" that is always on. Instances are created and destroyed on-demand.

### How to "Increase Instance" (Understanding Concurrency)

You don't manually "increase instances." Instead, you manage **concurrency**.

**Concurrency**: The number of executions of your function that are happening simultaneously.

If your function is invoked while all existing execution environments are busy processing other events, Lambda will automatically create a new execution environment (a "new instance") to handle the new invocation.

You can control this behavior in two ways:

- **Reserved Concurrency**: You can reserve a specific number of concurrent executions for a function. This guarantees it that much capacity and also prevents it from using any more, protecting downstream resources.

- **Provisioned Concurrency**: You can pre-warm a specific number of execution environments to be ready to respond immediately, avoiding cold starts.

## Cold Start vs. Warm Start

This is a crucial concept for performance.

### Cold Start

The first time a function is invoked after a period of inactivity, Lambda has to:

1. **Init**: Create a new execution environment.
2. **Bootstrap**: Load your code and dependencies into the environment.
3. **Run**: Execute your function's handler code.

This Init phase adds latency (typically 100ms - 2s, depending on runtime and code size).

### Warm Start

If a function is invoked again shortly after a previous invocation, Lambda may reuse the existing execution environment. This means it skips the Init phase and jumps straight to the Run phase, resulting in much lower latency.

### How to mitigate cold starts?

- **Provisioned Concurrency**: This is the primary solution. You tell Lambda to pre-initialize a specified number of execution environments (keeping them "warm"). Invocations sent to a function with Provisioned Concurrency are guaranteed to have a warm environment ready, eliminating cold starts.

- **Keep your deployment package small**: Smaller ZIP files (code + dependencies) initialize faster.

- **Use simpler runtimes**: Generally, runtimes like Node.js and Python start faster than Java or .NET (though they have improved significantly).

## Provisioned Concurrency vs. On-Demand

| Feature | On-Demand (Default) | Provisioned Concurrency |
|---------|-------------------|------------------------|
| **How it works** | Lambda automatically scales instances up and down from zero based on incoming traffic. | You pre-pay to keep a specific number of instances always initialized and warm. |
| **Cold Starts** | Yes. Likely to occur after periods of inactivity or during sudden traffic spikes. | No. Invocations are routed to the pre-warmed environments, eliminating cold starts. |
| **Cost** | Pay only for request count and duration. | Pay for the amount of concurrency provisioned per hour, plus the standard request and duration costs when it's invoked. |
| **Use Case** | Irregular or unpredictable traffic, background tasks where latency isn't critical. | APIs, user-facing applications, or any workload where predictable, low-latency response is critical. |

## Pros and Cons

### Pros

- **Zero Administration**: No servers to manage.
- **Automatic Scaling**: Handles from one request per day to thousands per second seamlessly.
- **Cost-Effective**: No cost when idle; you only pay for active compute time.
- **Event-Driven**: Deeply integrated with the AWS ecosystem, making it easy to build powerful, responsive applications.

### Cons

- **Cold Starts**: Can introduce unpredictable latency, especially for VPC-connected functions or infrequently used functions.
- **Execution Limits**: Functions have limits on timeout (15 minutes), temporary disk space (/tmp, 10 GB), and memory (10 GB).
- **Debugging & Monitoring**: Can be more complex than traditional applications. Requires reliance on CloudWatch Logs and X-Ray for observability.
- **Vendor Lock-in**: Your application's logic is tightly coupled to AWS's infrastructure and event formats.

## How Lambda Listens to Events (SQS, S3, API Gateway)

Lambda doesn't "listen" in the traditional sense. Instead, AWS services are integrated to invoke your Lambda function synchronously or asynchronously.

### 1. API Gateway (Synchronous Invocation)

**How**: You create a REST or HTTP API in API Gateway. You then integrate a specific route (e.g., POST /users) with your Lambda function.

**Flow**:
1. User makes an HTTP request to your API endpoint.
2. API Gateway receives the request and acts as a trigger.
3. API Gateway synchronously invokes the Lambda function (it waits for the response).
4. Lambda executes the function and returns a response to API Gateway.
5. API Gateway returns that response to the user.

### 2. Amazon S3 (Asynchronous Invocation)

**How**: You configure an S3 bucket to send events (e.g., `s3:ObjectCreated:*`) to your Lambda function.

**Flow**:
1. A user uploads a new file (cat.png) to the S3 bucket.
2. S3 generates an event ("a new object was created").
3. S3 places this event in an internal event queue and asynchronously invokes the Lambda function (it doesn't wait for a response).
4. Lambda polls this internal queue, retrieves the event, and executes your function.
5. If the function fails, Lambda will retry the invocation twice more.

### 3. Amazon SQS (Poll-Based Invocation)

**How**: You configure a Lambda function to be triggered by an SQS queue. This is fundamentally different.

**Flow**:
1. A producer application sends a message to the SQS queue.
2. The Lambda service (not the SQS service) polls the SQS queue continuously using long polling.
3. When Lambda detects messages in the queue, it retrieves a batch (up to 10 messages) and synchronously invokes your function, passing the batch of messages as the event payload.
4. If your function returns successfully, Lambda deletes the messages from the queue.
5. If your function returns an error or times out, Lambda does not delete the messages. They become visible in the queue again after the visibility timeout expires and will be retried. This makes SQS + Lambda a very resilient, decoupled architecture.

## Summary of Invocation Styles

| Trigger | Invocation Type | Key Characteristic |
|---------|----------------|-------------------|
| API Gateway | Synchronous | Request/Response. Lambda returns a response directly to the caller. |
| S3, SNS, EventBridge | Asynchronous | Event is placed in a Lambda queue. Lambda processes it and retries on failure. |
| SQS, Kinesis, DynamoDB Streams | Poll-Based | Lambda service polls the stream or queue and invokes your function with batches of records. |

## S3 Events and Queues - Clarification

### So S3 place event in queue so we need to register queue also? Or it directly invoke lambda?

Excellent question! This gets to a key detail in how AWS services integrate.

**The short answer is**: No, you do not need to create or register a queue yourself. AWS handles it automatically, but conceptually, a queue is involved.

### The Invisible Queue (Asynchronous Invocation)

When you configure an S3 bucket to send an event to a Lambda function, here is what happens in the background:

1. You create the link between the S3 bucket and the Lambda function (the "trigger").
2. When an event happens in S3 (e.g., a new file is uploaded), the S3 service does not directly call your Lambda function.
3. Instead, S3 places the event message into an **internal AWS-managed queue**. This queue is completely invisible to you; you cannot access it, manage it, or see it in your AWS account. It's part of the Lambda service's internal plumbing.
4. The Lambda service polls this internal queue.
5. When it finds an event, it invokes your Lambda function.

So, while a queue is conceptually part of the process, it is abstracted away entirely from you. You just see the result: S3 event triggers Lambda.

### This is different from SQS

This is why the behavior is different from when you use a visible queue like Amazon SQS, which you create and manage.

| Feature | S3 (Asynchronous Invocation) | SQS (Poll-Based Invocation) |
|---------|------------------------------|------------------------------|
| **Queue Visibility** | Invisible & AWS-managed. You don't see it or manage it. | Visible & You-manage. You create the SQS queue, see messages in it, and configure its settings. |
| **Retry Behavior** | If your Lambda function fails, Lambda retries twice (for a total of 3 attempts). After that, the event is discarded. You can configure a Dead-Letter Queue (DLQ) to catch these failed events. | If your Lambda function fails, the message stays in the SQS queue and becomes visible again after the visibility timeout. You control the number of retries by configuring how many times a message can be received before being sent to a DLQ. This is much more resilient. |
| **Who Does the Work?** | The Lambda service polls its internal queue and invokes your function. | The Lambda service polls your SQS queue and invokes your function. |
| **Batching** | Not applicable. Each event typically invokes the function once. | Yes. Lambda can retrieve up to 10 messages at once and send them as a batch to a single function invocation. |

### Summary

- **S3 -> Lambda**: Uses an invisible, internal queue. You don't need to do anything with queues. You just set up the trigger, and it works. The retry logic is simple and limited.

- **SQS -> Lambda**: Uses a visible, customer-managed queue. You must create the SQS queue and then configure Lambda to poll it. This gives you much more control and resilience for processing messages.