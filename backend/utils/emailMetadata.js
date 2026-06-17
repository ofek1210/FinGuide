const normalizeEmailMetadataForApi = rawDocument => {
  const nested = rawDocument?.emailMetadata;
  if (nested && typeof nested === 'object') {
    return {
      subject: nested.subject || null,
      from: nested.from || null,
      date: nested.date || null,
      gmailMessageId: nested.gmailMessageId || null,
      gmailAttachmentId: nested.gmailAttachmentId || null,
    };
  }

  // Legacy flat fields from earlier imports
  if (rawDocument?.gmailMessageId) {
    return {
      subject: rawDocument.emailSubject || null,
      from: rawDocument.emailFrom || null,
      date: rawDocument.emailDate || null,
      gmailMessageId: rawDocument.gmailMessageId || null,
      gmailAttachmentId: rawDocument.gmailAttachmentId || null,
    };
  }

  return null;
};

const buildEmailMetadataQuery = ({ gmailMessageId, gmailAttachmentId }) => {
  if (!gmailMessageId || !gmailAttachmentId) {
    return null;
  }

  return {
    $or: [
      {
        'emailMetadata.gmailMessageId': gmailMessageId,
        'emailMetadata.gmailAttachmentId': gmailAttachmentId,
      },
      { gmailMessageId, gmailAttachmentId },
    ],
  };
};

module.exports = {
  normalizeEmailMetadataForApi,
  buildEmailMetadataQuery,
};
