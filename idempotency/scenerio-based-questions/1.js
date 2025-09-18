
//A user double-clicks ‘Pay Now’ in your e-commerce app. How do you prevent two payments?”


// payment-service.js - Improved Lock Management
const redis = require('redis');
const mysql = require('mysql2/promise');

class PaymentService {
  constructor() {
    // ... existing constructor code
    
    // Lock configuration
    this.lockConfig = {
      lockTimeout: 30000, // 30 seconds lock duration
      retryDelay: 100,    // 100ms between retries
      maxRetries: 3       // Maximum retry attempts
    };
  }

  // Improved lock acquisition with retry mechanism
  async acquireIdempotencyLock(key) {
    const { lockTimeout, retryDelay, maxRetries } = this.lockConfig;
    const lockKey = `payment:lock:${key}`;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Use SET with NX and EX for atomic lock acquisition
        const result = await this.redisClient.set(
          lockKey,
          'inprogress',
          {
            NX: true,       // Only set if not exists (NX = Not eXists)
            EX: Math.floor(lockTimeout / 1000)  // Convert ms to seconds
          }
        );
        
        if (result === 'OK') {
          return true; // Lock acquired successfully
        }
        
        // If we can't get the lock, check if it's still valid
        const lockValue = await this.redisClient.get(lockKey);
        if (lockValue === 'inprogress') {
          // Lock is still held by another process, wait and retry
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          return false; // Max retries reached
        }
        
        // Lock exists but value is not 'inprogress', try to acquire again
        continue;
        
      } catch (error) {
        console.error('Error acquiring lock on attempt', attempt + 1, error);
        if (attempt === maxRetries - 1) {
          throw error; // Throw error on final attempt
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    return false;
  }

  // Improved lock release - only release if we own the lock
  async releaseIdempotencyLock(key, force = false) {
    const lockKey = `payment:lock:${key}`;
    
    try {
      if (force) {
        // Force delete (use with caution)
        await this.redisClient.del(lockKey);
        console.log('Force released lock:', key);
        return true;
      }
      
      // Use Redis transactions for atomic lock release
      const multi = this.redisClient.multi();
      
      // Watch the lock key to ensure it hasn't changed
      multi.watch(lockKey);
      
      // Get current value
      multi.get(lockKey);
      
      const results = await multi.exec();
      
      if (results && results[0] === 'inprogress') {
        // Delete only if we still own the lock
        await this.redisClient.del(lockKey);
        console.log('Lock released successfully:', key);
        return true;
      }
      
      console.log('Lock was already released or expired:', key);
      return false;
      
    } catch (error) {
      console.error('Error releasing lock:', error);
      return false;
    }
  }

  // Improved payment processing with better lock management
  async processPayment(paymentRequest, idempotencyKey) {
    const { userId, orderId, amount, paymentMethod } = paymentRequest;
    
    let lockAcquired = false;
    
    try {
      // Try to acquire lock with idempotency key
      lockAcquired = await this.acquireIdempotencyLock(idempotencyKey);
      
      if (!lockAcquired) {
        return {
          success: false,
          error: 'Payment already in progress',
          code: 'PAYMENT_IN_PROGRESS'
        };
      }

      // Check if payment already completed
      const existingResult = await this.checkExistingPayment(idempotencyKey);
      if (existingResult) {
        await this.releaseIdempotencyLock(idempotencyKey);
        return existingResult;
      }

      // Process the actual payment
      const paymentResult = await this.executePayment(paymentRequest, idempotencyKey);
      
      // Store successful payment result
      await this.storePaymentResult(idempotencyKey, paymentResult);
      
      // Release the lock
      await this.releaseIdempotencyLock(idempotencyKey);
      
      return paymentResult;

    } catch (error) {
      // Release lock on error only if we acquired it
      if (lockAcquired) {
        await this.releaseIdempotencyLock(idempotencyKey, true); // Force release on error
      }
      throw error;
    }
  }

  // Execute actual payment logic
  async executePayment(paymentRequest) {
    const { userId, orderId, amount, paymentMethod } = paymentRequest;
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Random success/failure for demo
    const success = Math.random() > 0.2;
    
    if (success) {
      // Save to MySQL database
      const connection = await this.mysqlPool.getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Check if payment already exists in DB (additional safety)
        const [existingPayments] = await connection.execute(
          `SELECT id FROM payments WHERE idempotency_key = ?`,
          [idempotencyKey]
        );
        
        if (existingPayments.length > 0) {
          const existingPayment = existingPayments[0];
          return {
            success: true,
            paymentId: existingPayment.id,
            message: 'Payment was already processed',
            amount: amount,
            duplicate: true
          };
        }
        
        // Insert payment record
        const [result] = await connection.execute(
          `INSERT INTO payments (user_id, order_id, amount, payment_method, status, idempotency_key, created_at) 
           VALUES (?, ?, ?, ?, 'completed', ?, NOW())`,
          [userId, orderId, amount, paymentMethod, idempotencyKey]
        );
        
        // Update order status
        await connection.execute(
          `UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`,
          [orderId]
        );
        
        await connection.commit();
        
        return {
          success: true,
          paymentId: result.insertId,
          message: 'Payment successful',
          amount: amount
        };
        
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else {
      return {
        success: false,
        error: 'Payment failed',
        code: 'PAYMENT_FAILED'
      };
    }
  }

  // Improved store payment result
  async storePaymentResult(key, result, ttl = 86400) {
    try {
      // Store result with expiration
      await this.redisClient.set(
        `payment:result:${key}`,
        JSON.stringify(result),
        {
          EX: ttl
        }
      );
      
      console.log('Payment result stored for key:', key);
      
    } catch (error) {
      console.error('Error storing payment result:', error);
      throw error;
    }
  }

   // Check if payment already completed
  async checkExistingPayment(key) {
    try {
      const result = await this.redisClient.get(`payment:result:${key}`);
      if (result) {
        return JSON.parse(result);
      }
      return null;
    } catch (error) {
      console.error('Error checking existing payment:', error);
      return null;
    }
  }

  // Additional method to check lock status
  async getLockStatus(idempotencyKey) {
    try {
      const lockValue = await this.redisClient.get(`payment:lock:${idempotencyKey}`);
      const resultValue = await this.redisClient.get(`payment:result:${idempotencyKey}`);
      
      return {
        lock: lockValue,
        result: resultValue ? JSON.parse(resultValue) : null,
        exists: lockValue !== null || resultValue !== null
      };
    } catch (error) {
      console.error('Error getting lock status:', error);
      throw error;
    }
  }

  // Clean up expired locks (can be run periodically)
  async cleanupExpiredLocks() {
    // This is a simplified example - in production you might use
    // Redis SCAN with a pattern to find and clean up old locks
    
    console.log('Lock cleanup functionality would be implemented here');
  }
}

module.exports = PaymentService;