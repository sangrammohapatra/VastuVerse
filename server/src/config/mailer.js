/**
 * Email transport (nodemailer). In production it uses SMTP from EMAIL_HOST/USER/PASS;
 * in dev with no EMAIL_HOST set it falls back to `jsonTransport`, which doesn't send
 * real mail but returns the payload so we can log the OTP to the server console.
 */

const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!process.env.EMAIL_HOST) {
    console.warn('[mailer] EMAIL_HOST not set — using JSON transport (no real mail sent)');
    _transporter = nodemailer.createTransport({ jsonTransport: true });
    return _transporter;
  }
  const port = Number(process.env.EMAIL_PORT) || 587;
  _transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465, // SMTPS for 465, STARTTLS for 587
    auth: process.env.EMAIL_USER
      ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      : undefined,
  });
  return _transporter;
}

async function sendOtpEmail(to, otp) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@vastuverse.app';
  const info = await getTransporter().sendMail({
    from: `"VastuVerse" <${from}>`,
    to,
    subject: 'Your VastuVerse verification code',
    text: `Your VastuVerse verification code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore the email.`,
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;color:#1A1A2E;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="font-family:'Playfair Display',serif;color:#2E7D32;margin:0 0 12px">Verify your VastuVerse account</h2>
        <p>Use the code below to sign in. It expires in 10 minutes.</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#00BCD4;margin:24px 0">${otp}</p>
        <p style="color:rgba(26,26,46,0.66);font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
  // Dev convenience: surface the OTP in logs when using jsonTransport.
  if (process.env.NODE_ENV !== 'production') {
    console.log('[mailer] OTP email queued', { to, otp, messageId: info.messageId });
  }
  return info;
}

async function sendInviteEmail({ to, inviterName, planTitle, inviteUrl, permission }) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@vastuverse.app';
  const permissionLabel = { view: 'view-only', comment: 'comment', edit: 'edit' }[permission] || permission;
  const info = await getTransporter().sendMail({
    from: `"VastuVerse" <${from}>`,
    to,
    subject: `${inviterName} invited you to collaborate on a VastuVerse plan`,
    text:
      `${inviterName} invited you to collaborate on "${planTitle}" with ${permissionLabel} permission.\n\n` +
      `Accept the invite: ${inviteUrl}\n\n` +
      `This link expires in 14 days. If you don't have a VastuVerse account yet, you'll be prompted to create one with this email address.`,
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;color:#1A1A2E;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="font-family:'Playfair Display',serif;color:#2E7D32;margin:0 0 12px">You're invited to collaborate</h2>
        <p><strong>${inviterName}</strong> invited you to collaborate on the VastuVerse plan
          <strong>${planTitle}</strong> with <em>${permissionLabel}</em> permission.</p>
        <p style="margin:24px 0">
          <a href="${inviteUrl}"
             style="background:#2E7D32;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
            Accept invitation
          </a>
        </p>
        <p style="color:rgba(26,26,46,0.66);font-size:13px">
          This invite expires in 14 days. If you don't have a VastuVerse account yet, you'll be prompted to
          create one with this email address.
        </p>
        <p style="color:rgba(26,26,46,0.5);font-size:12px;margin-top:32px;word-break:break-all">
          If the button doesn't work, paste this link into your browser:<br>${inviteUrl}
        </p>
      </div>
    `,
  });
  if (process.env.NODE_ENV !== 'production') {
    console.log('[mailer] invite email queued', { to, planTitle, messageId: info.messageId });
  }
  return info;
}

module.exports = { getTransporter, sendOtpEmail, sendInviteEmail };
