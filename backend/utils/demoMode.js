

/**
 * Demo/mock responses are disabled in production to avoid misleading users.
 */
function isDemoRequest(req) {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  if (req?.query?.demo === 'true') {
    return true;
  }
  const body = req?.body;
  return body?.demo === true || body?.demo === 'true';
}

module.exports = { isDemoRequest };
