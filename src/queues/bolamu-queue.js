const { Queue } = require('bullmq');

const connection = { 
  host: process.env.REDIS_HOST || 'localhost', 
  port: process.env.REDIS_PORT || 6379 
};

const bolamuQueue = new Queue('bolamu', { connection });

async function addNotificationJob(type, payload) {
  await bolamuQueue.add('send-notification', { type, payload }, { 
    attempts: 3, 
    backoff: { type: 'exponential', delay: 5000 } 
  });
}

module.exports = { bolamuQueue, addNotificationJob };
