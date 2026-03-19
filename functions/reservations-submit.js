// Custom reservation submit handler (bypasses Netlify Forms redirect issues).
// Receives JSON body with reservation fields and stores to Netlify Blobs.
exports.handler = async (event) => {
  let body = {};
  try {
    body = event && event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    body = {};
  }

  // Basic spam honeypot: if bot-field has any value, ignore.
  if (body['bot-field']) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, ignored: true }),
    };
  }

  const record = {
    id: '',
    created_at: new Date().toISOString(),
    form_name: process.env.RESERVATIONS_FORM_NAME || 'reservations',
    name: body.full_name || body.name || '',
    email: body.email || '',
    phone: body.phone || '',
    reservation_date: body.reservation_date || '',
    reservation_time: body.reservation_time || '',
    party_size: body.party_size || '',
    notes: body.notes || '',
  };

  record.id = String(Date.now());
  const key = `reservations/${record.id}`;

  const { getStore, connectLambda } = await import('@netlify/blobs');
  if (typeof connectLambda === 'function') {
    connectLambda(event);
  }
  const store = getStore({ name: 'reservations' });

  try {
    await store.set(key, JSON.stringify(record));
  } catch (e) {
    // Still attempt email; storage failures shouldn't block reservation request.
    console.log('Reservation blob save failed:', e && e.message ? e.message : e);
  }

  // Optional: send via webhook
  const webhookUrl = process.env.RESERVATIONS_EMAIL_WEBHOOK_URL;
  var emailOk = false;
  var webhookOk = false;
  var webhookError = '';
  if (webhookUrl) {
    try {
      var webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reservation_created',
          reservation: record,
          submission_id: record.id,
          created_at: record.created_at,
        }),
      });
      emailOk = webhookRes && webhookRes.ok ? true : emailOk;
      webhookOk = webhookRes && webhookRes.ok ? true : false;
      if (webhookRes && !webhookRes.ok) {
        var txt = await webhookRes.text().catch(function () { return ''; });
        console.log('Webhook responded non-2xx:', webhookRes.status, txt ? txt.slice(0, 500) : '');
        webhookError = (txt || '').slice(0, 500);
      }
    } catch (e) {
      console.log('Reservation webhook failed:', e && e.message ? e.message : e);
      webhookError = e && e.message ? e.message : String(e);
    }
  }

  // Optional: send via Resend
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendTo = process.env.RESEND_TO_EMAIL;
  const resendFrom = process.env.RESEND_FROM_EMAIL;
  var resendOk = false;
  var resendError = '';

  // Debug: log only non-sensitive configuration.
  try {
    const maskEmail = function (email) {
      if (!email || typeof email !== 'string') return '';
      var parts = email.split('@');
      if (parts.length !== 2) return email;
      var user = parts[0];
      var domain = parts[1];
      var head = user.slice(0, 2);
      return head + '***@' + domain;
    };
    console.log('Email providers config:',
      {
        webhookConfigured: !!webhookUrl,
        resendConfigured: !!(resendApiKey && resendTo && resendFrom),
        resendTo: maskEmail(resendTo),
        resendFrom: maskEmail(resendFrom),
      }
    );
  } catch (e) {
    // ignore
  }

  if (resendApiKey && resendTo && resendFrom) {
    try {
      const datePart = record.reservation_date ? ` ${record.reservation_date}` : '';
      const timePart = record.reservation_time ? ` ${record.reservation_time}` : '';
      const subject = `New reservation from ${record.name || 'Guest'} (${datePart}${timePart})`.trim();

      const text =
        `New reservation request\n\n` +
        `ID: ${record.id || ''}\n` +
        `Guest: ${record.name || ''}\n` +
        `Email: ${record.email || ''}\n` +
        `Phone: ${record.phone || ''}\n` +
        `Date: ${record.reservation_date || ''}\n` +
        `Time: ${record.reservation_time || ''}\n` +
        `Party size: ${record.party_size || ''}\n` +
        `Notes: ${record.notes || ''}\n`;

      const payload = {
        from: resendFrom,
        to: resendTo,
        subject: subject,
        text: text,
      };

      if (record.email) {
        payload.reply_to = record.email;
      }

      var resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + resendApiKey,
        },
        body: JSON.stringify(payload),
      });
      emailOk = resendRes && resendRes.ok ? true : emailOk;
      resendOk = resendRes && resendRes.ok ? true : false;
      if (resendRes && !resendRes.ok) {
        var txt = await resendRes.text().catch(function () { return ''; });
        console.log('Resend responded non-2xx:', resendRes.status, txt ? txt.slice(0, 500) : '');
        resendError = (txt || '').slice(0, 500);
      }
    } catch (e) {
      console.log('Resend email failed:', e && e.message ? e.message : e);
      resendError = e && e.message ? e.message : String(e);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      emailOk: emailOk,
      emailDetails: {
        webhookConfigured: !!webhookUrl,
        webhookOk: webhookOk,
        webhookError: webhookError,
        resendConfigured: !!(resendApiKey && resendTo && resendFrom),
        resendOk: resendOk,
        resendError: resendError,
      },
    }),
  };
};

