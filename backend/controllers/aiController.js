const {
  checkAIAvailability,
  generateAnswer,
} = require('../services/aiService');

// RTL mark for terminal display
const RLM = '\u200F';

function isHello(msg) {
  return /^תגיד(י)? לי שלום( בעברית)?$/.test(msg);
}

function isPensionQuestion(msg) {
  return msg.includes('כמה') && msg.includes('פנסיה') && msg.includes('להפריש');
}

async function chatWithAI(req, res) {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'message is required (string)',
    });
  }

  const msg = message.trim();

  // ✅ Rule-based replies (stable + fast)
  if (isHello(msg)) {
    return res.json({ success: true, answer: `${RLM}שלום 😊`, source: 'rule' });
  }

  if (isPensionQuestion(msg)) {
    return res.json({
      success: true,
      answer:
        `${RLM}בישראל לרוב ההפרשות לפנסיה הן סביב 6% עובד, 6.5% מעסיק ועוד רכיב פיצויים; בפועל זה תלוי בסוג ההסכם והאם השכר מבוטח מלא.`,
      source: 'rule',
    });
  }

  const availability = await checkAIAvailability();
  if (!availability.available) {
    return res.status(503).json({
      success: false,
      message: 'שירות ה-AI אינו זמין כרגע.',
      source: availability.source,
    });
  }

  // LLM call
  const { answer, source } = await generateAnswer(msg);

  return res.json({
    success: true,
    answer: answer ? `${RLM}${answer}` : `${RLM}לא הצלחתי לענות כרגע.`,
    source,
  });
}

async function getAIStatus(req, res) {
  const availability = await checkAIAvailability();

  return res.json({
    success: true,
    data: availability,
  });
}

module.exports = {
  chatWithAI,
  getAIStatus,
};
