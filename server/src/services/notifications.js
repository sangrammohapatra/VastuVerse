/**
 * Notifications fan-out for marketplace events.
 *
 *   notify({ socket, email, whatsapp }) — every channel best-effort, failures
 *   are logged but never propagate. Socket emit goes through getIO()'s
 *   room/user/broadcast targets.
 *
 * WhatsApp is stubbed: in production this would call Twilio's WhatsApp
 * Business API (or Meta's Cloud API). For now we just log so the event
 * shape is exercised end-to-end.
 */

const { getIO } = require('../config/socket');
const { getTransporter } = require('../config/mailer');

async function notify({ socket, email, whatsapp } = {}) {
  // Socket emit — to a specific room (user:{id}, architects, plan:{id}:status, etc.)
  if (socket) {
    try {
      const io = getIO();
      if (io && socket.room && socket.event) {
        io.to(socket.room).emit(socket.event, socket.payload || {});
      }
    } catch (e) {
      console.warn('[notify] socket fanout failed:', e.message);
    }
  }

  // Email
  if (email && email.to) {
    try {
      const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@vastuverse.app';
      await getTransporter().sendMail({
        from: `"VastuVerse" <${from}>`,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html || `<div style="font-family:Inter,system-ui;color:#1A1A2E;padding:20px;max-width:520px">${email.text}</div>`,
      });
    } catch (e) {
      console.warn('[notify] email failed:', e.message);
    }
  }

  // WhatsApp — stubbed
  if (whatsapp && whatsapp.to) {
    try {
      // TODO: replace with Twilio WhatsApp / Meta Cloud API call.
      // POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
      //   To=whatsapp:{phone}, From=whatsapp:{TWILIO_FROM}, Body={text}
      console.log('[notify] whatsapp stub →', whatsapp.to, '·', whatsapp.text?.slice(0, 80));
    } catch (e) {
      console.warn('[notify] whatsapp stub failed:', e.message);
    }
  }
}

module.exports = { notify };
