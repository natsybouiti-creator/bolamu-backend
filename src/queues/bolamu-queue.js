const { Queue } = require('bullmq');

const connection = { 
  host: process.env.REDIS_HOST || 'localhost', 
  port: process.env.REDIS_PORT || 6379 
};

const bolamuQueue = new Queue('bolamu', { connection });

module.exports = { bolamuQueue };
