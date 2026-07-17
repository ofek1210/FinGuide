const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Document = require('../models/Document');
const { AppError } = require('../utils/appErrors');
const { encrypt, decrypt } = require('../utils/tokenCrypto');
const { buildEmailMetadataQuery } = require('../utils/emailMetadata');
const {
  GMAIL_READONLY_SCOPE,
  getGoogleClientId,
  getGoogleClientSecret,
  getGmailRedirectUri,
  buildGmailSearchQuery,
} = require('../config/gmailIntegration');
const {
  processFinancialDocument,
  saveIncomingPdfToUploads,
  removeFileQuietly,
} = require('./financialDocumentService');
const { serializeDocument } = require('../serializers/documentSerializer');

const MAX_MESSAGES_PER_SYNC = 40;

const createOAuthClient = redirectUri => {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientSecret) {
    throw new AppError(
      'חיבור Gmail דורש GOOGLE_CLIENT_SECRET בשרת. הוסיפו ב-Google Cloud Console OAuth client.',
      503
    );
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri || getGmailRedirectUri());
};

const loadUserWithGmailSecrets = async userId =>
  User.findById(userId).select('+gmailIntegration.accessTokenEnc +gmailIntegration.refreshTokenEnc');

const getStoredTokens = user => {
  const integration = user?.gmailIntegration;
  if (!integration?.connected) {
    return null;
  }

  return {
    accessToken: decrypt(integration.accessTokenEnc),
    refreshToken: decrypt(integration.refreshTokenEnc),
    tokenExpiry: integration.tokenExpiry,
    gmailEmail: integration.gmailEmail,
    connectedAt: integration.connectedAt,
    lastSyncAt: integration.lastSyncAt,
  };
};

const persistTokens = async (user, { accessToken, refreshToken, expiryDate, gmailEmail }) => {
  user.gmailIntegration = {
    connected: true,
    connectedAt: user.gmailIntegration?.connectedAt || new Date(),
    lastSyncAt: user.gmailIntegration?.lastSyncAt || null,
    gmailEmail: gmailEmail || user.gmailIntegration?.gmailEmail || null,
    accessTokenEnc: encrypt(accessToken),
    refreshTokenEnc: encrypt(
      refreshToken ||
        (user.gmailIntegration?.refreshTokenEnc
          ? decrypt(user.gmailIntegration.refreshTokenEnc)
          : null)
    ),
    tokenExpiry: expiryDate ? new Date(expiryDate) : null,
  };
  await user.save();
};

const getAuthorizedGmailClient = async user => {
  const tokens = getStoredTokens(user);
  if (!tokens?.refreshToken && !tokens?.accessToken) {
    throw new AppError('Gmail לא מחובר', 400);
  }

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.tokenExpiry ? tokens.tokenExpiry.getTime() : undefined,
  });

  oauth2Client.on('tokens', async newTokens => {
    if (!newTokens.access_token) {
      return;
    }

    const freshUser = await loadUserWithGmailSecrets(user._id);
    if (!freshUser?.gmailIntegration?.connected) {
      return;
    }

    freshUser.gmailIntegration.accessTokenEnc = encrypt(newTokens.access_token);
    if (newTokens.refresh_token) {
      freshUser.gmailIntegration.refreshTokenEnc = encrypt(newTokens.refresh_token);
    }
    if (newTokens.expiry_date) {
      freshUser.gmailIntegration.tokenExpiry = new Date(newTokens.expiry_date);
    }
    await freshUser.save();
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
};

const buildConnectAuthUrl = redirectUri => {
  const oauth2Client = createOAuthClient(redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GMAIL_READONLY_SCOPE],
    include_granted_scopes: true,
  });
};

const connectWithAuthorizationCode = async (userId, { code, redirectUri }) => {
  if (!getGoogleClientSecret()) {
    throw new AppError(
      'חיבור Gmail דורש GOOGLE_CLIENT_SECRET בשרת. הוסיפו ב-Google Cloud Console OAuth client.',
      503
    );
  }

  if (!code) {
    return { authUrl: buildConnectAuthUrl(redirectUri) };
  }

  const oauth2Client = createOAuthClient(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const profile = await oauth2.userinfo.get();
  const gmailEmail = profile?.data?.email || null;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('משתמש לא נמצא', 404);
  }

  if (!tokens.refresh_token) {
    throw new AppError(
      'לא התקבל refresh token. נתקו את החיבור ב-Google Account והתחברו שוב עם אישור מלא.',
      400
    );
  }

  await persistTokens(user, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date,
    gmailEmail,
  });

  return {
    connected: true,
    gmailEmail,
    connectedAt: user.gmailIntegration.connectedAt,
  };
};

const disconnectGmail = async userId => {
  const user = await loadUserWithGmailSecrets(userId);
  if (!user) {
    throw new AppError('משתמש לא נמצא', 404);
  }

  user.gmailIntegration = {
    connected: false,
    connectedAt: null,
    lastSyncAt: null,
    gmailEmail: null,
    accessTokenEnc: null,
    refreshTokenEnc: null,
    tokenExpiry: null,
  };
  await user.save();

  return { connected: false };
};

const decodeBase64Url = data =>
  Buffer.from(String(data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const extractHeader = (headers, name) => {
  const match = (headers || []).find(
    header => header.name && header.name.toLowerCase() === name.toLowerCase()
  );
  return match?.value || null;
};

const collectPdfAttachments = payload => {
  const results = [];

  const visit = part => {
    if (!part) {
      return;
    }

    if (Array.isArray(part)) {
      part.forEach(visit);
      return;
    }

    if (part.filename && part.body?.attachmentId) {
      const isPdf =
        (part.mimeType || '').toLowerCase() === 'application/pdf' ||
        part.filename.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        results.push({
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          size: part.body.size,
        });
      }
    }

    if (part.parts?.length) {
      visit(part.parts);
    }
  };

  visit(payload);
  return results;
};

const isDuplicateImport = async (userId, { gmailMessageId, gmailAttachmentId }) => {
  const idQuery = buildEmailMetadataQuery({ gmailMessageId, gmailAttachmentId });
  if (!idQuery) {
    return false;
  }

  const existing = await Document.findOne({
    user: userId,
    ...idQuery,
  }).select('_id');

  return Boolean(existing);
};

const syncGmailPayslips = async userId => {
  const user = await loadUserWithGmailSecrets(userId);
  if (!user?.gmailIntegration?.connected) {
    throw new AppError('Gmail לא מחובר', 400);
  }

  const gmail = await getAuthorizedGmailClient(user);
  const query = buildGmailSearchQuery();

  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: MAX_MESSAGES_PER_SYNC,
  });

  const messages = listResponse.data.messages || [];
  const summary = {
    found: 0,
    imported: 0,
    skippedDuplicates: 0,
    failed: 0,
    documents: [],
  };

  for (const messageRef of messages) {
    const fullMessage = await gmail.users.messages.get({
      userId: 'me',
      id: messageRef.id,
      format: 'full',
    });

    const headers = fullMessage.data.payload?.headers || [];
    const subject = extractHeader(headers, 'Subject');
    const from = extractHeader(headers, 'From');
    const dateRaw = extractHeader(headers, 'Date');
    const parsedDate = dateRaw ? new Date(dateRaw) : null;
    const gmailMessageId = fullMessage.data.id;

    const attachments = collectPdfAttachments(fullMessage.data.payload);
    summary.found += attachments.length;

    for (const attachment of attachments) {
      if (
        await isDuplicateImport(userId, {
          gmailMessageId,
          gmailAttachmentId: attachment.attachmentId,
        })
      ) {
        summary.skippedDuplicates += 1;
        continue;
      }

      let filePath;
      try {
        const attachmentResponse = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: gmailMessageId,
          id: attachment.attachmentId,
        });

        const buffer = decodeBase64Url(attachmentResponse.data.data);
        if (!buffer.length) {
          summary.failed += 1;
          continue;
        }

        ({ filePath } = await saveIncomingPdfToUploads(buffer, attachment.filename));

        const result = await processFinancialDocument({
          userId,
          filePath,
          originalName: attachment.filename || 'payslip.pdf',
          source: 'gmail',
          metadata: { category: 'payslip' },
          emailMetadata: {
            subject,
            from,
            date: Number.isNaN(parsedDate?.getTime?.()) ? null : parsedDate,
            gmailMessageId,
            gmailAttachmentId: attachment.attachmentId,
          },
        });

        summary.imported += 1;
        if (result?.routedTo) {
          summary.documents.push({
            routedTo: result.routedTo,
            message: result.message,
          });
        } else {
          summary.documents.push(serializeDocument(result));
        }
      } catch (error) {
        console.error('[gmail] import attachment failed', {
          userId,
          gmailMessageId,
          attachmentId: attachment.attachmentId,
          error: error.message,
        });
        summary.failed += 1;
        await removeFileQuietly(filePath);
      }
    }
  }

  user.gmailIntegration.lastSyncAt = new Date();
  await user.save();

  return summary;
};

const getGmailIntegrationStatus = async userId => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('משתמש לא נמצא', 404);
  }

  const integration = user.gmailIntegration || {};
  const importedCount = await Document.countDocuments({
    user: userId,
    source: 'gmail',
  });

  const recentImports = await Document.find({
    user: userId,
    source: 'gmail',
  })
    .sort('-uploadedAt')
    .limit(20)
    .lean();

  return {
    connected: Boolean(integration.connected),
    gmailEmail: integration.gmailEmail || null,
    connectedAt: integration.connectedAt || null,
    lastSyncAt: integration.lastSyncAt || null,
    importedCount,
    recentImports: recentImports.map(serializeDocument),
    redirectUri: getGmailRedirectUri(),
    oauthConfigured: Boolean(getGoogleClientSecret()),
  };
};

module.exports = {
  buildConnectAuthUrl,
  connectWithAuthorizationCode,
  disconnectGmail,
  syncGmailPayslips,
  getGmailIntegrationStatus,
  buildGmailSearchQuery,
  isDuplicateImport,
};
