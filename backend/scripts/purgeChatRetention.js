#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Purge orphan ChatMessages whose Conversation was TTL-deleted,
 * and optionally dry-run retention.
 * Usage: node scripts/purgeChatRetention.js [--write]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');

async function main() {
  const write = process.argv.includes('--write');
  await mongoose.connect(process.env.MONGODB_URI);
  const convIds = await Conversation.distinct('_id');
  const orphanFilter = { conversationId: { $nin: convIds } };
  const count = await ChatMessage.countDocuments(orphanFilter);
  console.log(`Orphan chat messages: ${count}`);
  if (write && count > 0) {
    const res = await ChatMessage.deleteMany(orphanFilter);
    console.log(`Deleted: ${res.deletedCount}`);
  } else {
    console.log('Dry-run only (pass --write to delete).');
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
