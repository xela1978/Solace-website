// Daily job: email guests one calendar day after their reservation date, asking for a Google review.
// Trigger: Netlify Scheduled Functions (see netlify.toml). Requires RESEND_* env like reservations-submit.
//
// Env (optional):
//   REVIEW_FOLLOWUP_ENABLED        default "true" — set "false" to disable sends
//   REVIEW_FOLLOWUP_TIMEZONE       default "America/New_York" (Lawrence, MA)
//   REVIEW_FOLLOWUP_URL            default https://solacebraziliansteakhouse.com/review (short link → Google)
//   REVIEW_FOLLOWUP_REQUIRE_PROCESSED default "true" — only guests marked "processed" in admin
//   REVIEW_FOLLOWUP_CRON_SECRET    if set, allows manual POST with ?secret=... for testing

const DEFAULT_REVIEW_URL = 'https://solacebraziliansteakhouse.com/review';

function getTodayYMD(timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Days from reservationDate (YYYY-MM-DD) to today (same TZ). Returns null if invalid. */
function daysAfterReservation(reservationDateStr, todayYMD) {
  if (!reservationDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(reservationDateStr))) return null;
  var a = new Date(String(reservationDateStr) + 'T12:00:00Z');
  var b = new Date(String(todayYMD) + 'T12:00:00Z');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function (m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
  });
}

function isNetlifyScheduled(event) {
  const h = event && event.headers ? event.headers : {};
  var v = h['x-netlify-event'] || h['X-Netlify-Event'] || '';
  if (String(v).toLowerCase() === 'scheduled') return true;
  // Newer scheduled invocations may send JSON body { next_run: "..." }
  if (event && event.body) {
    try {
      var b = JSON.parse(event.body);
      if (b && typeof b.next_run === 'string') return true;
    } catch (e) {
      /* ignore */
    }
  }
  return false;
}

function isManualAuthorized(event) {
  var secret = process.env.REVIEW_FOLLOWUP_CRON_SECRET;
  if (!secret) return false;
  var qs = (event && event.queryStringParameters) || {};
  var q = qs.secret || qs.key || '';
  return q === secret;
}

exports.handler = async function (event) {
  if (event && event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  if (!isNetlifyScheduled(event) && !isManualAuthorized(event)) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Forbidden (scheduled or secret only)' }),
    };
  }

  if (String(process.env.REVIEW_FOLLOWUP_ENABLED || 'true').toLowerCase() === 'false') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, skipped: true, reason: 'REVIEW_FOLLOWUP_ENABLED=false' }),
    };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;
  if (!resendApiKey || !resendFrom) {
    console.log('scheduled-review-followup: missing RESEND_API_KEY or RESEND_FROM_EMAIL');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Resend not configured' }),
    };
  }

  const timeZone = process.env.REVIEW_FOLLOWUP_TIMEZONE || 'America/New_York';
  const reviewUrl = process.env.REVIEW_FOLLOWUP_URL || DEFAULT_REVIEW_URL;
  const requireProcessed = String(process.env.REVIEW_FOLLOWUP_REQUIRE_PROCESSED || 'true').toLowerCase() === 'true';
  const maxDaysAfterVisit = Math.min(
    90,
    Math.max(1, parseInt(process.env.REVIEW_FOLLOWUP_MAX_DAYS_AFTER_VISIT || '14', 10) || 14)
  );
  const todayYMD = getTodayYMD(timeZone);

  const { getStore, connectLambda } = await import('@netlify/blobs');
  if (typeof connectLambda === 'function') {
    connectLambda(event);
  }
  const store = getStore({ name: 'reservations' });

  const { blobs } = await store.list({ prefix: 'reservations/' });
  var sent = 0;
  var skipped = 0;
  var errors = [];

  for (var i = 0; i < blobs.length; i++) {
    var b = blobs[i];
    var v;
    try {
      v = await store.get(b.key);
    } catch (e) {
      continue;
    }
    if (!v) continue;

    var record;
    try {
      record = typeof v === 'string' ? JSON.parse(v) : v;
    } catch (e) {
      continue;
    }

    if (!record || !record.email) {
      skipped++;
      continue;
    }
    if (record.review_followup_sent_at) {
      skipped++;
      continue;
    }
    if (!record.reservation_date) {
      skipped++;
      continue;
    }
    var daysAfter = daysAfterReservation(String(record.reservation_date), todayYMD);
    if (daysAfter === null || daysAfter < 1 || daysAfter > maxDaysAfterVisit) {
      skipped++;
      continue;
    }
    if (requireProcessed && record.status !== 'processed') {
      skipped++;
      continue;
    }

    var guestName = record.name ? escapeHtml(record.name) : 'Guest';
    var subject = 'How was your visit at Solace?';
    var html =
      '<!doctype html>' +
      '<html><body style="margin:0; padding:0; background:#050505;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;">' +
      '<tr><td align="center" style="padding:26px 14px;">' +
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#161616; border:1px solid #2A2A2A; border-radius:24px; overflow:hidden;">' +
      '<tr><td style="padding:22px 26px; text-align:center; background:rgba(200,162,74,0.08);">' +
      '<img src="https://solacebraziliansteakhouse.com/image/logo1.png" width="180" alt="Solace" style="display:block; margin:0 auto;"/>' +
      '<h1 style="margin:12px 0 0; font-family:Inter,Arial,sans-serif; color:#F5F5F5; font-size:22px; line-height:1.3;">Thank you for dining with us</h1>' +
      '<p style="margin:8px 0 0; font-family:Inter,Arial,sans-serif; color:#A0A0A0; font-size:14px;">Hi ' +
      guestName +
      ', we hope you enjoyed your time at Solace Brazilian Steakhouse &amp; Bar.</p>' +
      '</td></tr>' +
      '<tr><td style="padding:18px 26px 26px;">' +
      '<p style="margin:0; font-family:Inter,Arial,sans-serif; color:#F5F5F5; font-size:15px; line-height:1.6;">If you have a moment, we would be grateful for a quick review on Google. It helps other guests discover us.</p>' +
      '<p style="margin:22px 0 0; text-align:center;">' +
      '<a href="' +
      escapeHtml(reviewUrl) +
      '" style="display:inline-block; padding:14px 28px; background:#C8A24A; color:#0A0A0A; font-family:Inter,Arial,sans-serif; font-size:15px; font-weight:700; text-decoration:none; border-radius:14px;">Leave a Google review</a>' +
      '</p>' +
      '<p style="margin:20px 0 0; font-family:Inter,Arial,sans-serif; color:#A0A0A0; font-size:13px; line-height:1.6;">101 Essex St, Lawrence, MA · (978) 616-2060</p>' +
      '</td></tr>' +
      '<tr><td style="padding:18px 26px; text-align:center; color:#A0A0A0; font-family:Inter,Arial,sans-serif; font-size:12px; border-top:1px solid rgba(42,42,42,0.9);">' +
      '© Solace Brazilian Steakhouse &amp; Bar' +
      '</td></tr>' +
      '</table></td></tr></table></body></html>';

    var text =
      'Thank you for dining at Solace Brazilian Steakhouse & Bar.\n\n' +
      'We would be grateful if you could leave a short review on Google:\n' +
      reviewUrl +
      '\n\n101 Essex St, Lawrence, MA · (978) 616-2060';

    try {
      var res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + resendApiKey,
        },
        body: JSON.stringify({
          from: resendFrom,
          to: record.email,
          subject: subject,
          html: html,
          text: text,
        }),
      });

      if (!res.ok) {
        var errTxt = await res.text().catch(function () {
          return '';
        });
        errors.push({ id: record.id, status: res.status, err: errTxt.slice(0, 200) });
        console.log('Resend failed for', record.id, res.status, errTxt.slice(0, 200));
        continue;
      }

      record.review_followup_sent_at = new Date().toISOString();
      var key = b.key || 'reservations/' + record.id;
      await store.set(key, JSON.stringify(record));
      sent++;
      console.log('Review follow-up sent for reservation', record.id, record.email);
    } catch (e) {
      errors.push({ id: record.id, err: e && e.message ? e.message : String(e) });
      console.log('Review follow-up error:', e);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      todayYMD: todayYMD,
      timeZone: timeZone,
      requireProcessed: requireProcessed,
      maxDaysAfterVisit: maxDaysAfterVisit,
      sent: sent,
      skipped: skipped,
      errors: errors,
    }),
  };
};
