/**
 * מינוי משתמש כמנהל (או הסרה).
 * שימוש: node scripts/makeAdmin.js user@example.com [--revoke]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const main = async () => {
  const email = process.argv[2];
  const revoke = process.argv.includes('--revoke');

  if (!email) {
    console.error('שימוש: node scripts/makeAdmin.js <email> [--revoke]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const role = revoke ? 'user' : 'admin';
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { role },
    { new: true }
  );

  if (!user) {
    console.error(`משתמש לא נמצא: ${email}`);
    process.exit(1);
  }

  console.log(`✅ ${user.email} — role: ${user.role}`);
  await mongoose.disconnect();
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
