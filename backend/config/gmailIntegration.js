const PAYSLIP_SEARCH_KEYWORDS = Object.freeze([
  'תלוש',
  'תלוש שכר',
  'שכר',
  'payslip',
  'pay slip',
  'salary',
  '106',
]);

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

const SHARED_GOOGLE_CLIENT_ID =
  '757872744940-rvibdtmd65cif13ia19tm78npjdn8i7l.apps.googleusercontent.com';

const getGoogleClientId = () => process.env.GOOGLE_CLIENT_ID || SHARED_GOOGLE_CLIENT_ID;

const getGoogleClientSecret = () => process.env.GOOGLE_CLIENT_SECRET || '';

const getClientUrl = () =>
  process.env.CLIENT_URL || process.env.APP_PUBLIC_URL || 'http://localhost:5173';

const getGmailRedirectUri = () => {
  const base = getClientUrl().replace(/\/$/, '');
  return `${base}/integrations/email`;
};

const buildGmailSearchQuery = () => {
  const keywordClause = PAYSLIP_SEARCH_KEYWORDS.map(keyword => `"${keyword}"`).join(' OR ');
  return `has:attachment filename:pdf (${keywordClause})`;
};

module.exports = {
  PAYSLIP_SEARCH_KEYWORDS,
  GMAIL_READONLY_SCOPE,
  SHARED_GOOGLE_CLIENT_ID,
  getGoogleClientId,
  getGoogleClientSecret,
  getClientUrl,
  getGmailRedirectUri,
  buildGmailSearchQuery,
};
