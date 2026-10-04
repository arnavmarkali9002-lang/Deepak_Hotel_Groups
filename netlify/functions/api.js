const serverless = require('serverless-http');
const { server, ensureSupabaseDataFresh } = require('../../server.js');

let isWarmed = false;

const handler = serverless(server, {
  provider: 'aws',
  request(request, event, context) {
    // Keep context alive
    context.callbackWaitsForEmptyEventLoop = false;
  }
});

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (!isWarmed) {
    try {
      if (typeof ensureSupabaseDataFresh === 'function') {
        await ensureSupabaseDataFresh(true);
      }
      isWarmed = true;
    } catch (e) {
      console.error('[Netlify Function] Initial Supabase sync error:', e.message);
    }
  }
  return await handler(event, context);
};
