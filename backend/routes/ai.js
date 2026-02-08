const express = require("express");
const router = express.Router();

const { chatWithAI } = require("../controllers/aiController");

router.post("/chat", (req, res, next) => {
  Promise.resolve(chatWithAI(req, res)).catch(next);
});

module.exports = router;
