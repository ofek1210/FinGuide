

const { runAgentDebate, streamAgentDebate, buildDemoDebate } = require('../ai/agents/debateOrchestrator');
const { isDemoRequest } = require('../utils/demoMode');

async function runDebateHandler(req, res) {
  if (isDemoRequest(req)) {
    return res.json(buildDemoDebate());
  }

  const { skipLLM = false } = req.body || {};
  const result = await runAgentDebate(req.user._id, { skipLLM: skipLLM === true });
  return res.json(result);
}

async function streamDebateHandler(req, res) {
  const demo = isDemoRequest(req);
  const { skipLLM = false } = req.body || {};

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = data => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await streamAgentDebate(req.user._id, {
      skipLLM: skipLLM === true,
      demo,
      onEvent: sendEvent,
    });
    res.end();
  } catch (err) {
    sendEvent({ type: 'error', message: err.message || 'שגיאה בהרצת הדיון' });
    res.end();
  }
}

module.exports = { runDebateHandler, streamDebateHandler };
