/** Google publication delivery: credentials remain server-side, never in build variables. */
export function googlePublicationSmtpOptions(value) {
  const user = typeof value.user === 'string' ? value.user.trim().toLowerCase() : '';
  const pass = typeof value.pass === 'string' ? value.pass.replace(/\s/g, '') : '';
  if (!/^[a-z0-9._+-]+@sozorockfoundation\.org$/.test(user) || !/^[a-z]{16}$/.test(pass)) {
    throw new Error('Invalid Google publication credential');
  }
  return {
    host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true, auth: { user, pass },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
  };
}
export function createGooglePublicationMailer({ getSecret, createTransport, secretId, now = Date.now }) {
  let cached;
  let expiresAt = 0;
  return async function send({ from, to, subject, text, html }) {
    if (!secretId) throw new Error('Google publication mail is not configured');
    try {
      if (!cached || now() >= expiresAt) {
        const value = JSON.parse(await getSecret(secretId));
        const options = googlePublicationSmtpOptions(value);
        cached = { user: options.auth.user, transport: createTransport(options) };
        expiresAt = now() + 5 * 60 * 1000;
      }
      if (from?.toLowerCase() !== cached.user || !to || /[\r\n]/.test(to + subject)) {
        throw new Error('Invalid publication mail envelope');
      }
      const delivered = await cached.transport.sendMail({
        from: { name: 'SozoRock Foundation Publications', address: cached.user },
        to, subject, text, html,
        envelope: { from: cached.user, to: [to] },
        disableFileAccess: true, disableUrlAccess: true,
      });
      if (!delivered.accepted?.some(address => String(address).toLowerCase() === to.toLowerCase())) {
        throw new Error('Publication recipient was not accepted');
      }
    } catch {
      cached = undefined;
      expiresAt = 0;
      // Provider errors can contain email addresses or message content. Do not propagate them.
      const error = new Error('Google publication delivery failed');
      error.name = 'PublicationDeliveryError';
      throw error;
    }
  };
}
