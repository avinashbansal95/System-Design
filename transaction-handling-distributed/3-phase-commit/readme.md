# Three-Phase Commit (3PC) Protocol: Complete Guide

## What is Three-Phase Commit (3PC)?

Three-Phase Commit (3PC) is a distributed consensus algorithm that improves upon 2PC by reducing blocking and enabling recovery from coordinator failures, under certain assumptions.

It ensures atomicity across multiple services/databases while trying to avoid indefinite blocking when a participant or coordinator crashes.

🔑 **Key idea:** Break the "uncertainty" phase in 2PC by adding an intermediate pre-commit phase.

## Steps of Three-Phase Commit (3PC)

3PC has three phases:

### 🟦 Phase 1: Voting (Prepare) Phase
*(Same as in 2PC)*

1. Coordinator sends **prepare** message to all participants
2. Each participant:
   - Performs local transaction work
   - Checks if it can commit
   - Replies with **Yes** or **No**
3. If any participant says **No**, coordinator sends abort
4. If all say **Yes**, move to Phase 2

🔁 This phase is non-blocking so far.

### 🟨 Phase 2: Pre-Commit Phase

1. Coordinator sends **pre-commit** message to all participants
2. Participants acknowledge they are ready to commit, but do not yet commit
3. Participant enters a state where:
   - It **must commit** if it receives the final doCommit
   - It can safely abort only if it knows the coordinator failed before sending pre-commit

🎯 **Purpose:** Ensure no participant is left in an uncertain state where it doesn't know whether to commit or abort.

### 🟩 Phase 3: Commit Phase

1. After receiving acknowledgments from all participants in Phase 2, the coordinator sends **doCommit**
2. All participants commit their transactions
3. Each replies with **ack**
4. Transaction completes

🔄 If coordinator fails after pre-commit, participants can elect a new coordinator or timeout and commit, assuming the decision was to commit.

## 🔗 States in 3PC

| State | Description |
|-------|-------------|
| **Can Block** | Before **prepare** responses |
| **Prepared** | All said **Yes**, waiting for **pre-commit** |
| **Pre-Committed** | Received **pre-commit**, must eventually commit |
| **Committed** | Final **doCommit** received |

## 🔄 Failure Handling in 3PC

| Scenario | Behavior |
|----------|----------|
| **Coordinator fails before pre-commit** | Participants can safely abort after timeout |
| **Coordinator fails after pre-commit** | Participants can **proceed to commit** (since all were ready) |
| **Participant fails** | Others wait or timeout; new coordinator can resume |

⚠️ **Assumption:** Network partitions are rare, and failure detection is reliable (which is hard in practice).

## 🌍 Real-Life Example: Flight Booking System

Let's imagine a travel booking platform with 3 microservices:

- **Booking Service** (Node.js + MySQL) – creates booking
- **Flight Service** (Node.js + MySQL) – reserves seat
- **Payment Service** (Node.js + MySQL) – charges user

You want to book a flight — this must:
- Reserve a seat ✅
- Charge the customer ✅
- Confirm booking ✅

**All or nothing** — but we want better fault tolerance than 2PC.

We'll simulate 3PC with a coordinator (e.g., Booking Service).

### 🧱 Architecture Overview

```
[Client]
   ↓
[Booking Service] ←→ [Flight Service]
   ↓                    ↓
[Payment Service] ←→ (MySQL DBs)
```

Each service has its own MySQL database.

## 🛠️ Step-by-Step Node.js Implementation (Simplified)

⚠️ **Note:** True 3PC requires timeout mechanisms, failure detection, and persistent logs. This is a conceptual simulation.

### 🔹 Step 1: Client Triggers Booking

```javascript
// bookingService.js
app.post('/book', async (req, res) => {
  const { flightId, userId, amount } = req.body;
  const bookingId = generateId();

  const coordinator = new ThreePCCoordinator();

  try {
    const success = await coordinator.executeTransaction({
      bookingId,
      flightId,
      userId,
      amount
    });

    if (success) {
      res.status(200).json({ message: "Flight booked successfully!" });
    } else {
      res.status(400).json({ message: "Booking failed" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 🔹 Step 2: Coordinator Executes 3PC

```javascript
class ThreePCCoordinator {
  async executeTransaction(data) {
    const { bookingId, flightId, userId, amount } = data;

    const participants = [
      { name: 'FlightService', url: 'http://flight:3001' },
      { name: 'PaymentService',  url: 'http://payment:3002' }
    ];

    // Phase 1: Prepare
    const votes = [];
    for (const p of participants) {
      try {
        const res = await axios.post(`${p.url}/prepare`, { bookingId, flightId, userId });
        votes.push(res.data.vote === 'YES');
      } catch (err) {
        votes.push(false);
      }
    }

    if (!votes.every(vote => vote)) {
      // Abort early
      await this.sendDecision(participants, bookingId, 'ABORT');
      return false;
    }

    // Phase 2: Pre-Commit
    let preCommitSuccess = true;
    for (const p of participants) {
      try {
        await axios.post(`${p.url}/precommit`, { bookingId });
      } catch (err) {
        preCommitSuccess = false;
      }
    }

    if (!preCommitSuccess) {
      // If pre-commit fails, we can still abort safely
      await this.sendDecision(participants, bookingId, 'ABORT');
      return false;
    }

    // Phase 3: Do Commit
    await this.sendDecision(participants, bookingId, 'COMMIT');

    // Finalize booking
    await db.query('INSERT INTO bookings SET ?', {
      bookingId,
      flightId,
      userId,
      status: 'confirmed'
    });

    return true;
  }

  async sendDecision(participants, bookingId, decision) {
    for (const p of participants) {
      try {
        await axios.post(`${p.url}/decision`, { bookingId, decision });
      } catch (err) {
        console.error(`Failed to send ${decision} to ${p.name}`);
      }
    }
  }
}
```

### 🔹 Step 3: Flight Service (Participant)

```javascript
// flightService.js

// Phase 1: Prepare
app.post('/prepare', async (req, res) => {
  const { flightId } = req.body;
  const flight = await db.query('SELECT * FROM flights WHERE id = ? FOR UPDATE', [flightId]);

  if (flight.seatsAvailable > 0) {
    // Reserve seat temporarily
    await db.query('UPDATE flights SET reserved_seats = reserved_seats + 1 WHERE id = ?', [flightId]);
    res.json({ vote: 'YES' });
  } else {
    res.json({ vote: 'NO' });
  }
});

// Phase 2: Pre-Commit
app.post('/precommit', (req, res) => {
  const { bookingId } = req.body;
  logPreCommit(bookingId); // Just log intent
  res.json({ status: 'PRE-COMMITTED' });
});

// Phase 3: Final Decision
app.post('/decision', async (req, res) => {
  const { bookingId, decision } = req.body;

  if (decision === 'COMMIT') {
    await db.query('UPDATE flights SET seatsAvailable = seatsAvailable - 1, reserved_seats = reserved_seats - 1 WHERE id = ?', [flightId]);
  } else {
    await db.query('UPDATE flights SET reserved_seats = reserved_seats - 1 WHERE id = ?', [flightId]);
  }

  res.json({ ack: 'DONE' });
});
```

Payment Service would follow similar logic (e.g., reserve funds → pre-commit → charge).

## ⚠️ Cons of Three-Phase Commit (3PC)

| Problem | Description |
|---------|-------------|
| ❌ **Still Not Fully Fault-Tolerant** | Cannot handle **network partitions** safely. Assumes bounded network delays |
| ❌ **Complex Implementation** | Requires **precise timeouts**, **failure detection**, and **persistent logging** |
| ❌ **Not Widely Supported** | No standard DB or ORM support for 3PC |
| ❌ **Latency** | 3 rounds of communication → slower than 2PC |
| ❌ **Coordinator Still Critical** | While less blocking, coordinator failure **during transition** can still cause issues |
| ❌ **Assumes Synchronous Network** | Unrealistic in cloud environments (e.g., AWS, Kubernetes) |
| ❌ **No Real-World Adoption** | Rarely used in production systems |

## ✅ Pros of 3PC (vs 2PC)

| Advantage | Description |
|-----------|-------------|
| ✅ **Non-Blocking on Coordinator Failure** | If all participants are in **pre-commit**, they can **autonomously commit** after timeout |
| ✅ **Reduces Indefinite Blocking** | Solves the "hanging participant" problem of 2PC |
| ✅ **More Resilient** | Better recovery model than 2PC |

## 🤔 Is 3PC Recommended to Use?

❌ **No** — Not recommended for production systems.

✅ **But it's good to know for:**
- Understanding evolution of distributed consensus
- Learning trade-offs between consistency, availability, and fault tolerance
- Appreciating why Paxos, Raft, or Saga patterns are preferred

🔑 **3PC is theoretical and not practical** in modern distributed systems due to its strong assumptions about network behavior.

## 🔄 Modern Alternatives (Recommended)

| Pattern | Use Case |
|---------|----------|
| **Saga Pattern** | Long-running business processes (e.g., order, booking) |
| **Event Sourcing + CQRS** | High scalability, audit trail |
| **Outbox Pattern** | Reliable message publishing |
| **TCC (Try-Confirm-Cancel)** | Business-level distributed transactions |
| **Distributed Locking (Redis/ZooKeeper)** | Coordination without 2PC/3PC |
| **Consensus Algorithms (Raft, Paxos)** | For leader election and state machine replication |

## ✅ Summary Table

| Aspect | 3PC |
|--------|-----|
| **Phases** | Prepare, Pre-Commit, Commit |
| **Atomicity** | ✅ Yes |
| **Consistency** | ✅ Strong |
| **Fault Tolerance** | ⚠️ Limited (assumes no partitions) |
| **Blocking?** | ❌ Reduced, but not eliminated |
| **Latency** | High (3 rounds) |
| **Real-World Use** | ❌ Almost none |
| **Recommended?** | ❌ No — good to know, not to use |

## 📚 Final Verdict

- **Know 3PC** to understand how distributed systems evolved
- **Use Sagas, Events, or TCC** in real microservices

It's like learning assembly to understand high-level languages — not used daily, but foundational knowledge.