const config = require('../config/keys');
const { createClient } = require('redis');

class RedisBrixClient {
  constructor() {
    this.client = null;
  }

  async getClient() {
    if (!this.client) {
      this.client = createClient({
        socket: {
          host: config.redisHost,
          port: Number(config.redisPort),
        },
        ...(config.redisPassword && { password: config.redisPassword })
      });
      this.client.on('error', err => console.error('Redis Error', err));
      await this.client.connect();
    }
    return this.client;
  }
}

module.exports = new RedisBrixClient();