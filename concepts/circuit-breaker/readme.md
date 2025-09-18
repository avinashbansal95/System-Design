# Circuit Breaker Pattern in Node.js

## What is a Circuit Breaker?

The Circuit Breaker pattern is a fault-tolerance mechanism that prevents cascading failures in distributed systems. It acts like an electrical circuit breaker - when failures reach a threshold, it "trips" and stops further requests to a failing service.

## Why It's Essential in Microservices

In microservice architectures:

- Services are interdependent
- Network calls can fail
- One failing service can cascade failures to others
- Circuit breakers isolate failures and provide graceful degradation

## Circuit Breaker States

### 1. CLOSED State (Normal Operation)
- Requests flow normally to the service
- Failures are counted
- If failures exceed threshold → moves to OPEN state

### 2. OPEN State (Circuit Tripped)
- All requests are immediately rejected
- No calls to the failing service
- After timeout period → moves to HALF-OPEN state

### 3. HALF-OPEN State (Testing Recovery)
- Limited requests are allowed to test if service recovered
- If successful → moves to CLOSED state
- If failed → returns to OPEN state

## Node.js Implementation Example

### 1. Circuit Breaker Class

```javascript
class CircuitBreaker {
  constructor(service, options = {}) {
    this.service = service;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    
    // Configurable options
    this.options = {
      failureThreshold: 3,     // Failures needed to trip circuit
      successThreshold: 2,     // Successes needed to close circuit
      timeout: 10000,          // Time in OPEN state (ms)
      resetTimeout: 30000,     // Time to reset failure count
      ...options
    };
  }

  async call(request) {
    if (this.state === 'OPEN') {
      if (this.nextAttempt <= Date.now()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit is OPEN');
      }
    }

    try {
      const response = await this.service(request);
      this.onSuccess();
      return response;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.timeout;
    }
    
    // Reset failure count after timeout
    setTimeout(() => {
      this.failureCount = 0;
    }, this.options.resetTimeout);
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt
    };
  }
}
```

### 2. Microservice Clients with Circuit Breakers

```javascript
const axios = require('axios');

// User Service Client
class UserService {
  constructor() {
    this.circuitBreaker = new CircuitBreaker(this.makeRequest.bind(this), {
      failureThreshold: 2,
      timeout: 5000
    });
  }

  async makeRequest(userId) {
    const response = await axios.get(`http://user-service:3001/users/${userId}`, {
      timeout: 2000
    });
    return response.data;
  }

  async getUser(userId) {
    try {
      return await this.circuitBreaker.call(userId);
    } catch (error) {
      // Fallback response when circuit is open or service fails
      return {
        id: userId,
        name: 'Fallback User',
        email: 'fallback@example.com',
        fromCache: true
      };
    }
  }
}

// Order Service Client
class OrderService {
  constructor() {
    this.circuitBreaker = new CircuitBreaker(this.makeRequest.bind(this), {
      failureThreshold: 3,
      timeout: 10000
    });
  }

  async makeRequest(userId) {
    const response = await axios.get(`http://order-service:3002/orders/user/${userId}`, {
      timeout: 3000
    });
    return response.data;
  }

  async getOrders(userId) {
    try {
      return await this.circuitBreaker.call(userId);
    } catch (error) {
      // Fallback to empty orders
      return { orders: [], fromCache: true };
    }
  }
}

// Payment Service Client
class PaymentService {
  constructor() {
    this.circuitBreaker = new CircuitBreaker(this.makeRequest.bind(this), {
      failureThreshold: 2,
      timeout: 8000
    });
  }

  async makeRequest(userId) {
    const response = await axios.get(`http://payment-service:3003/payments/user/${userId}`, {
      timeout: 2500
    });
    return response.data;
  }

  async getPayments(userId) {
    try {
      return await this.circuitBreaker.call(userId);
    } catch (error) {
      // Fallback strategy
      return { payments: [], message: 'Payment service unavailable' };
    }
  }
}
```

### 3. Main API Service Using Circuit Breakers

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// Initialize service clients
const userService = new UserService();
const orderService = new OrderService();
const paymentService = new PaymentService();

// Health endpoint to check circuit breaker status
app.get('/health', (req, res) => {
  res.json({
    userService: userService.circuitBreaker.getStatus(),
    orderService: orderService.circuitBreaker.getStatus(),
    paymentService: paymentService.circuitBreaker.getStatus()
  });
});

// Main endpoint using all services
app.get('/user-dashboard/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  try {
    // Execute all service calls in parallel with circuit breakers
    const [user, orders, payments] = await Promise.allSettled([
      userService.getUser(userId),
      orderService.getOrders(userId),
      paymentService.getPayments(userId)
    ]);

    const response = {
      user: user.status === 'fulfilled' ? user.value : { error: 'User service unavailable' },
      orders: orders.status === 'fulfilled' ? orders.value : { error: 'Order service unavailable' },
      payments: payments.status === 'fulfilled' ? payments.value : { error: 'Payment service unavailable' },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simulate service failures for testing
app.post('/simulate-failure/:service', (req, res) => {
  const { service } = req.params;
  // This would simulate a service failure in real scenario
  res.json({ message: `Failure simulation triggered for ${service}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
```

### 4. Monitoring and Metrics

```javascript
// Add monitoring to circuit breaker
class MonitoredCircuitBreaker extends CircuitBreaker {
  constructor(service, options) {
    super(service, options);
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      stateChanges: []
    };
  }

  async call(request) {
    this.metrics.totalRequests++;
    try {
      const result = await super.call(request);
      this.metrics.successfulRequests++;
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  onStateChange(oldState, newState) {
    this.metrics.stateChanges.push({
      timestamp: Date.now(),
      from: oldState,
      to: newState
    });
  }

  getMetrics() {
    return this.metrics;
  }
}
```

### 5. Testing the Circuit Breaker

```javascript
// Test script to simulate failures
async function testCircuitBreaker() {
  const userService = new UserService();
  
  console.log('Testing Circuit Breaker...');
  
  // Make successful calls
  try {
    const user = await userService.getUser('123');
    console.log('Success:', user);
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  // Simulate service failure
  userService.makeRequest = async () => {
    throw new Error('Service unavailable');
  };
  
  // Make failing calls to trip circuit breaker
  for (let i = 0; i < 3; i++) {
    try {
      await userService.getUser('123');
    } catch (error) {
      console.log(`Call ${i+1}:`, error.message);
      console.log('Circuit State:', userService.circuitBreaker.getStatus().state);
    }
  }
  
  // Wait for timeout and test recovery
  setTimeout(async () => {
    try {
      const user = await userService.getUser('123');
      console.log('After timeout:', user);
    } catch (error) {
      console.log('Still open:', error.message);
    }
  }, 6000);
}

testCircuitBreaker();
```

## Key Benefits in Microservices

- **Fault Isolation**: Prevents single service failure from bringing down entire system
- **Graceful Degradation**: Provides fallback responses instead of complete failure
- **Automatic Recovery**: Periodically tests if failed services have recovered
- **Monitoring**: Provides visibility into service health and failure patterns
- **Resource Protection**: Prevents resource exhaustion from continuous retries

## Configuration Tips

- Adjust thresholds based on service criticality
- Set appropriate timeouts for different services
- Implement fallback strategies for each service
- Monitor and alert on circuit state changes
- Use different configurations for read vs write operations