/**
 * Notification service — the single entry point for "tell this user something happened."
 *
 *   sendNotification(userId, event, data)
 *     1. Look up the recipient + their language preference
 *     2. Build a localized title + body from per-event TEMPLATES
 *     3. Persist a Notification row (so the bell can show it)
 *     4. Socket-emit 'notification' to room user:{userId} (real-time pop)
 *     5. Send an email (nodemailer + HTML template)
 *     6. Send a WhatsApp message if WHATSAPP_API_TOKEN is set
 *
 * Every channel is best-effort: a failure in one (email outage, no socket
 * connection, no phone number) never blocks the others, never throws back.
 *
 * Events:
 *   generation_complete     · AI job finished (interior/exterior/3D/floor)
 *   collaborator_invited    · someone invited you to collaborate on a plan
 *   bid_placed              · architect placed a bid on your request
 *   bid_accepted            · homeowner accepted your bid (architect-side)
 *   review_submitted        · architect submitted their review
 *   review_accepted         · homeowner accepted your review (architect-side)
 *   payment_captured        · payment captured (any type)
 *   plan_status_changed     · plan flipped to a new status
 *   comment_added           · someone commented on your plan
 *   subscription_changed    · tier / status of subscription changed
 */

const Notification = require('../models/Notification');
const User = require('../models/User');
const { getIO } = require('../config/socket');
const { getTransporter } = require('../config/mailer');

/* ─── Event templates ─────────────────────────────────────────────── */

/**
 * Each template returns { title, body, emailSubject, emailHtml, whatsappText,
 * actionUrl }. The function receives `data` and the resolved `user` so it
 * can reach for the user's first name or formatting hints.
 *
 * Add a new event: add it here + add it to Notification.NOTIFICATION_EVENTS.
 * If an event isn't templated it gets a generic fallback.
 */
const TEMPLATES = {
  generation_complete: (d, u) => ({
    title: 'Your design is ready',
    body: d.kind === 'interior'   ? 'Interior renderings finished — open Step 4 to view.'
        : d.kind === 'exterior'   ? 'Exterior renderings finished — open Step 5 to view.'
        : d.kind === 'floor-plan' ? '3 floor-plan variants ready — open Step 3 to pick one.'
        : d.kind === 'bird-eye-3d'? '3D walkthrough ready — open Step 8.'
        : 'AI generation complete.',
    actionUrl: d.planId && d.stepNumber ? `/plans/${d.planId}/step/${d.stepNumber}` : '/dashboard',
    emailSubject: 'Your VastuVerse design is ready',
    emailHtml: emailWrap(`
      <h2 style="margin:0 0 12px">Your design is ready</h2>
      <p>Hi ${firstName(u)}, your ${d.kind || 'AI'} generation has finished.</p>
      <p style="margin:24px 0">
        <a href="${appUrl(d.planId && d.stepNumber ? `/plans/${d.planId}/step/${d.stepNumber}` : '/dashboard')}"
           style="background:#2E7D32;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;">
          Open in VastuVerse
        </a>
      </p>`),
    whatsappText: `Your VastuVerse ${d.kind || 'design'} is ready. Open: ${appUrl('/dashboard')}`,
  }),

  collaborator_invited: (d, u) => ({
    title: 'You were invited to collaborate',
    body: `${d.inviterName || 'A VastuVerse user'} invited you to "${d.planTitle || 'a plan'}" as ${d.role || 'editor'}.`,
    actionUrl: d.acceptUrl || '/dashboard',
    emailSubject: `${d.inviterName || 'A VastuVerse user'} invited you to collaborate`,
    emailHtml: emailWrap(`
      <h2 style="margin:0 0 12px">You've been invited</h2>
      <p><strong>${d.inviterName || 'A VastuVerse user'}</strong> invited you to collaborate on
        <strong>"${d.planTitle || 'a plan'}"</strong> as <em>${d.role || 'editor'}</em>.</p>
      <p style="margin:24px 0">
        <a href="${d.acceptUrl || appUrl('/dashboard')}"
           style="background:#2E7D32;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;">
          Accept invitation
        </a>
      </p>
      <p style="font-size:12px;color:#666">This link is valid for 14 days.</p>`),
    whatsappText: `${d.inviterName || 'Someone'} invited you to "${d.planTitle || 'a plan'}" on VastuVerse. Open: ${d.acceptUrl || appUrl('/dashboard')}`,
  }),

  bid_placed: (d, u) => ({
    title: 'New bid on your request',
    body: `${d.architectName || 'An architect'} bid ${inr(d.proposedFee)} — ${d.requestTitle || ''}`,
    actionUrl: '/marketplace',
    emailSubject: `New bid: ${inr(d.proposedFee)} from ${d.architectName || 'an architect'}`,
    emailHtml: emailWrap(`
      <h2 style="margin:0 0 12px">New bid received</h2>
      <p><strong>${d.architectName || 'An architect'}</strong> placed a bid on
        <strong>"${d.requestTitle || 'your request'}"</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:6px 0;color:#666">Bid amount</td><td style="text-align:right;font-weight:700;">${inr(d.proposedFee)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Timeline</td><td style="text-align:right;font-weight:700;">${d.proposedTimeline || '—'} days</td></tr>
      </table>
      <p style="margin:24px 0">
        <a href="${appUrl('/marketplace')}" style="background:#2E7D32;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;">View bid</a>
      </p>`),
    whatsappText: `New bid: ${inr(d.proposedFee)} from ${d.architectName || 'an architect'} on "${d.requestTitle || 'your request'}". ${appUrl('/marketplace')}`,
  }),

  bid_accepted: (d, u) => ({
    title: 'Your bid was accepted! 🎉',
    body: `${inr(d.proposedFee)} held in escrow. Submit your review when ready.`,
    actionUrl: '/architect',
    emailSubject: 'Your bid was accepted',
    emailHtml: emailWrap(`
      <h2 style="margin:0 0 12px;color:#2E7D32;">Bid accepted 🎉</h2>
      <p>Hi ${firstName(u)}, the homeowner accepted your bid on
        <strong>"${d.requestTitle || 'their request'}"</strong>.</p>
      <p><strong>${inr(d.proposedFee)}</strong> is now held in escrow.
         Payout (85%) is released when the homeowner accepts your submitted review.</p>
      <p style="margin:24px 0">
        <a href="${appUrl('/architect')}" style="background:#2E7D32;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;">Open workspace</a>
      </p>`),
    whatsappText: `🎉 Your bid was accepted on VastuVerse. ${inr(d.proposedFee)} in escrow. ${appUrl('/architect')}`,
  }),

  review_submitted: (d, u) => ({
    title: 'Your architect submitted a review',
    body: `${d.architectName || 'Your architect'} submitted a review of "${d.requestTitle || 'your plan'}".`,
    actionUrl: '/marketplace',
    emailSubject: 'Architect review submitted',
    emailHtml: emailWrap(`
      <h2 style="margin:0 0 12px">Review submitted</h2>
      <p><strong>${d.architectName || 'Your architect'}</strong> submitted their review on
        <strong>"${d.requestTitle || 'your plan'}"</strong>. Open the marketplace to view
        annotations, accept the review, and release payout.</p>
      <p style="margin:24px 0">
        <a href="${appUrl('/marketplace')}" style="background:#2E7D32;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;">View review</a>
      </p>`),
    whatsappText: `Architect review submitted on VastuVerse. ${appUrl('/marketplace')}`,
  }),

  review_accepted: (d, u) => ({
    title: 'Payout released',
    body: `${inr(d.payoutAmount)} transferred to your account.`,
    actionUrl: '/architect',
    emailSubject: 'Payout released',
    emailHtml: emailWrap(`
      <h2 style="margin:0 0 12px;color:#2E7D32;">Payout released</h2>
      <p>The homeowner accepted your review.
        <strong>${inr(d.payoutAmount)}</strong> has been queued for transfer to your account
        (less 15% platform commission).</p>`),
    whatsappText: `Payout ${inr(d.payoutAmount)} released by VastuVerse.`,
  }),

  payment_captured: (d, u) => ({
    title: 'Payment received',
    body: `${inr(d.amount)} · ${d.purpose || 'VastuVerse payment'}`,
    actionUrl: '/profile',
    emailSubject: 'VastuVerse payment confirmation',
    emailHtml: emailWrap(`
      <h2 style="margin:0 0 12px">Payment confirmation</h2>
      <p>We've received your payment of <strong>${inr(d.amount)}</strong>${d.purpose ? ` for <strong>${d.purpose}</strong>` : ''}.</p>
      <p style="font-size:12px;color:#666;font-family:monospace">Razorpay payment ID: ${d.razorpayPaymentId || '—'}</p>`),
    whatsappText: `Payment received: ${inr(d.amount)}${d.purpose ? ` · ${d.purpose}` : ''}.`,
  }),

  plan_status_changed: (d, u) => ({
    title: 'Plan status updated',
    body: `"${d.planTitle || 'Your plan'}" is now ${d.newStatus || '—'}.`,
    actionUrl: d.planId ? `/plans/${d.planId}/step/10` : '/dashboard',
    emailSubject: `Plan status: ${d.newStatus}`,
    emailHtml: emailWrap(`<p><strong>"${d.planTitle || 'Your plan'}"</strong> is now marked <strong>${d.newStatus || '—'}</strong>.</p>`),
    whatsappText: `"${d.planTitle || 'Your plan'}" is now ${d.newStatus}.`,
  }),

  comment_added: (d, u) => ({
    title: 'New comment on your plan',
    body: `${d.authorName || 'A collaborator'}: ${truncate(d.commentText, 80)}`,
    actionUrl: d.planId && d.stepNumber ? `/plans/${d.planId}/step/${d.stepNumber}` : '/dashboard',
    emailSubject: 'New comment on your plan',
    emailHtml: emailWrap(`
      <p><strong>${d.authorName || 'A collaborator'}</strong> commented:</p>
      <blockquote style="border-left:3px solid #2E7D32;padding:8px 14px;color:#444;background:#F5F5F5;border-radius:0 6px 6px 0;">
        ${escapeHtml(d.commentText || '')}
      </blockquote>`),
    whatsappText: `New comment from ${d.authorName || 'a collaborator'} on VastuVerse.`,
  }),

  subscription_changed: (d, u) => ({
    title: `Your subscription is now ${d.newTier || '—'}`,
    body: d.reason || 'Subscription updated.',
    actionUrl: '/profile',
    emailSubject: `Subscription updated: ${d.newTier || '—'}`,
    emailHtml: emailWrap(`
      <p>Your VastuVerse subscription is now <strong>${d.newTier || '—'}</strong>.</p>
      ${d.reason ? `<p style="color:#666">${escapeHtml(d.reason)}</p>` : ''}`),
    whatsappText: `Your VastuVerse subscription: ${d.newTier || '—'}.`,
  }),
};

/* ─── Public API ──────────────────────────────────────────────────── */

/**
 * Fire a notification.
 *
 *   userId   recipient user id (string or ObjectId)
 *   event    one of NOTIFICATION_EVENTS
 *   data     event-specific payload (see TEMPLATES above)
 *
 * Returns the persisted Notification doc (or null if something blocked
 * persistence — caller can ignore the result).
 */
async function sendNotification(userId, event, data = {}) {
  if (!userId || !event) {
    console.warn('[notificationService] missing userId or event');
    return null;
  }

  // Resolve user (for first name + email + phone + language).
  // We do not block on this — if the user lookup fails we still try to
  // emit the socket event so a logged-in tab gets it.
  let user = null;
  try {
    user = await User.findById(userId)
      .select('email fullName phone preferredLanguage notificationPreferences')
      .lean();
  } catch (e) {
    console.warn('[notificationService] user lookup failed:', e.message);
  }

  const tmpl = (TEMPLATES[event] || fallbackTemplate)(data, user);

  // 1. Persist
  let notification = null;
  try {
    notification = await Notification.create({
      userId,
      event,
      title: tmpl.title,
      body: tmpl.body,
      actionUrl: tmpl.actionUrl || null,
      data: data,
    });
  } catch (e) {
    console.warn('[notificationService] persist failed:', e.message);
  }

  // 2. Socket emit — to user:{userId} room
  try {
    const io = getIO();
    if (io && notification) {
      io.to(`user:${userId}`).emit('notification', {
        id: notification._id,
        event,
        title: notification.title,
        body: notification.body,
        actionUrl: notification.actionUrl,
        data: notification.data,
        createdAt: notification.createdAt,
        read: false,
      });
    }
  } catch (e) {
    console.warn('[notificationService] socket emit failed:', e.message);
  }

  // 3. Email
  if (user?.email && shouldEmail(user, event)) {
    try {
      const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@vastuverse.app';
      await getTransporter().sendMail({
        from: `"VastuVerse" <${from}>`,
        to: user.email,
        subject: tmpl.emailSubject || tmpl.title,
        text: stripHtml(tmpl.emailHtml || `${tmpl.title}\n\n${tmpl.body}`),
        html: tmpl.emailHtml || emailWrap(`<h2>${tmpl.title}</h2><p>${tmpl.body}</p>`),
      });
    } catch (e) {
      console.warn('[notificationService] email failed:', e.message);
    }
  }

  // 4. WhatsApp — gated on env (works with Meta WhatsApp Cloud API or any
  // generic webhook-style endpoint). We use the Fetch API so no new SDK
  // dependency is added.
  if (process.env.WHATSAPP_API_TOKEN && user?.phone && tmpl.whatsappText) {
    try {
      const url = process.env.WHATSAPP_API_URL;
      if (!url) {
        console.warn('[notificationService] WHATSAPP_API_TOKEN set but WHATSAPP_API_URL missing');
      } else {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: normalizePhone(user.phone),
            type: 'text',
            text: { body: tmpl.whatsappText },
          }),
        });
        if (!res.ok) {
          console.warn('[notificationService] WhatsApp send failed:', res.status, await res.text().catch(() => ''));
        }
      }
    } catch (e) {
      console.warn('[notificationService] WhatsApp error:', e.message);
    }
  }

  return notification;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function firstName(u) {
  if (!u) return 'there';
  if (u.fullName) return u.fullName.split(/\s+/)[0];
  if (u.email) return u.email.split('@')[0];
  return 'there';
}

function inr(paise) {
  if (paise === undefined || paise === null) return '—';
  return '₹' + Math.round(Number(paise) / 100).toLocaleString('en-IN');
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function appUrl(path) {
  const base = process.env.APP_URL || 'https://app.vastuverse.in';
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function normalizePhone(p) {
  // Strip everything except digits; ensure country code prefix
  const digits = String(p || '').replace(/\D/g, '');
  if (!digits) return '';
  // Indian default — if the user only stored 10 digits, assume +91
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function shouldEmail(user, event) {
  // Honor a per-event opt-out if the user has notificationPreferences
  // and explicitly disabled email for this event. Defaults to ON.
  const prefs = user?.notificationPreferences || {};
  if (prefs.email && prefs.email[event] === false) return false;
  return true;
}

function emailWrap(innerHtml) {
  return `<!doctype html><html><body style="margin:0;background:#F8F9FA;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;color:#1A1A2E;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="border-bottom:1px solid #eee;padding-bottom:18px;margin-bottom:24px;display:flex;align-items:center;gap:10px;">
        <span style="display:inline-block;width:28px;height:28px;border-radius:6px;background:linear-gradient(135deg,#2E7D32,#00BCD4);"></span>
        <strong style="font-size:18px;letter-spacing:.4px;">VastuVerse</strong>
      </div>
      ${innerHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#888;margin:0;">
        You're receiving this because you have an account on VastuVerse.
        Manage preferences in your <a href="${appUrl('/profile')}" style="color:#2E7D32;">profile settings</a>.
      </p>
    </div>
  </body></html>`;
}

function fallbackTemplate(data, u) {
  return {
    title: 'New activity on VastuVerse',
    body: 'You have a new notification.',
    actionUrl: '/dashboard',
    emailSubject: 'New activity on VastuVerse',
    emailHtml: emailWrap(`<p>Hi ${firstName(u)}, there's new activity on your account.</p>`),
    whatsappText: 'New activity on VastuVerse.',
  };
}

module.exports = { sendNotification };
