const redis = require('redis');
const config = require('../config');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: config.redisUrl
      });

      this.client.on('error', (err) => {
        console.error('Redis connection error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('Redis client ready');
      });

      this.client.on('end', () => {
        console.log('Redis connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;

    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('Disconnected from Redis');
    }
  }

  // Session caching methods
  async cacheSession(sessionId, sessionData, ttl = 3600) {
    try {
      if (!this.isConnected) return false;
      
      const key = `session:${sessionId}`;
      await this.client.setEx(key, ttl, JSON.stringify(sessionData));
      console.debug(`Cached session: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('Error caching session:', error);
      return false;
    }
  }

  async getSession(sessionId) {
    try {
      if (!this.isConnected) return null;
      
      const key = `session:${sessionId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error retrieving session from cache:', error);
      return null;
    }
  }

  // Transcription status caching
  async cacheTranscriptionStatus(transcriptionId, status, ttl = 1800) {
    try {
      if (!this.isConnected) return false;
      
      const key = `transcription:${transcriptionId}:status`;
      await this.client.setEx(key, ttl, status);
      return true;
    } catch (error) {
      console.error('Error caching transcription status:', error);
      return false;
    }
  }

  async getTranscriptionStatus(transcriptionId) {
    try {
      if (!this.isConnected) return null;
      
      const key = `transcription:${transcriptionId}:status`;
      return await this.client.get(key);
    } catch (error) {
      console.error('Error retrieving transcription status:', error);
      return null;
    }
  }

  // Rate limiting
  async checkRateLimit(identifier, maxRequests = 100, windowSeconds = 900) {
    try {
      if (!this.isConnected) return { allowed: true, remaining: maxRequests };
      
      const key = `rate_limit:${identifier}`;
      const current = await this.client.incr(key);
      
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
      
      const remaining = Math.max(0, maxRequests - current);
      const allowed = current <= maxRequests;
      
      return { allowed, remaining, current };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { allowed: true, remaining: maxRequests };
    }
  }

  // Generic cache methods
  async set(key, value, ttl = 3600) {
    try {
      if (!this.isConnected) return false;
      
      if (ttl) {
        await this.client.setEx(key, ttl, JSON.stringify(value));
      } else {
        await this.client.set(key, JSON.stringify(value));
      }
      return true;
    } catch (error) {
      console.error('Error setting cache value:', error);
      return false;
    }
  }

  async get(key) {
    try {
      if (!this.isConnected) return null;
      
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting cache value:', error);
      return null;
    }
  }

  async delete(key) {
    try {
      if (!this.isConnected) return false;
      
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Error deleting cache value:', error);
      return false;
    }
  }

  async exists(key) {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Error checking if key exists:', error);
      return false;
    }
  }

  // Pub/Sub for real-time updates
  async publish(channel, message) {
    try {
      if (!this.isConnected) return false;
      
      await this.client.publish(channel, JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error publishing message:', error);
      return false;
    }
  }

  async subscribe(channel, callback) {
    try {
      if (!this.isConnected) return false;
      
      const subscriber = this.client.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe(channel, (message) => {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch (error) {
          console.error('Error parsing subscribed message:', error);
        }
      });
      
      return subscriber;
    } catch (error) {
      console.error('Error subscribing to channel:', error);
      return null;
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  // Get Redis info
  async getInfo() {
    try {
      if (!this.isConnected) return null;
      
      const info = await this.client.info();
      return info;
    } catch (error) {
      console.error('Error getting Redis info:', error);
      return null;
    }
  }
}

// Export singleton instance
const redisService = new RedisService();

module.exports = redisService;