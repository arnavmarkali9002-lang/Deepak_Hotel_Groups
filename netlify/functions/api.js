const serverless = require('serverless-http');
const { server } = require('../../server.js');

const handler = serverless(server, {
  provider: 'aws',
  request(request, event, context) {
    // Keep context alive
    context.callbackWaitsForEmptyEventLoop = false;
  }
});

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  return await handler(event, context);
};
