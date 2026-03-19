// Custom reservation submit handler (bypasses Netlify Forms redirect issues).
// Receives JSON body with reservation fields and stores to Netlify Blobs.
exports.handler = async (event) => {
  const reqId = String(Date.now()) + '-' + Math.random().toString(16).slice(2, 8);
  console.log('reservations-submit called. reqId=', reqId);

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
  console.log('reservations-submit storing reservation. reqId=', reqId, 'key=', key);

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
  var managerOk = false;
  var customerOk = true;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

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
      // if customer email is missing, we treat it as non-blocking.
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
      managerOk = !!(resendRes && resendRes.ok);
      emailOk = managerOk;
      resendOk = managerOk;
      if (resendRes && !resendRes.ok) {
        var txt = await resendRes.text().catch(function () { return ''; });
        console.log('Resend responded non-2xx:', resendRes.status, txt ? txt.slice(0, 500) : '');
        resendError = (txt || '').slice(0, 500);
      } else {
        // Success path: log status + message id (if present).
        try {
          var json = await resendRes.json().catch(function () { return null; });
          console.log('Resend email sent:', resendRes.status, json && (json.id || json.messageId) ? (json.id || json.messageId) : '');
        } catch (e) {
          console.log('Resend email sent:', resendRes.status);
        }
      }

      // Send elegant confirmation email to the customer.
      // We only do this if customer email exists.
      if (record.email) {
        customerOk = false; // we set to true only if send succeeds.
        var customerName = record.name ? escapeHtml(record.name) : 'Guest';
        var customerNotes = record.notes ? escapeHtml(record.notes) : '';
        var customerDate = record.reservation_date ? escapeHtml(record.reservation_date) : '';
        var customerTime = record.reservation_time ? escapeHtml(record.reservation_time) : '';
        var customerParty = record.party_size ? escapeHtml(record.party_size) : '';
        var customerPhone = record.phone ? escapeHtml(record.phone) : '';

        var customerSubject = `Reservation received, ${record.name ? record.name : 'Guest'}`;
        var customerHtml =
          '<!doctype html>' +
          '<html><body style="margin:0; padding:0; background:#050505;">' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;">' +
          '<tr><td align="center" style="padding:26px 14px;">' +
          '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#161616; border:1px solid #2A2A2A; border-radius:24px; overflow:hidden;">' +
          '<tr><td style="padding:22px 26px; text-align:center; background:rgba(200,162,74,0.08);">' +
          '<img src="https://solacebraziliansteakhouse.com/image/logo1.png" width="180" alt="Solace" style="display:block; margin:0 auto;"/>' +
          '<h1 style="margin:12px 0 0; font-family:Inter,Arial,sans-serif; color:#F5F5F5; font-size:22px; line-height:1.3;">Reservation received</h1>' +
          '<p style="margin:8px 0 0; font-family:Inter,Arial,sans-serif; color:#A0A0A0; font-size:14px;">Hi ' + customerName + ', thank you for booking with Solace Brazilian Steakhouse &amp; Bar.</p>' +
          '</td></tr>' +
          '<tr><td style="padding:18px 26px 26px;">' +
          '<div style="font-family:Playfair Display,Georgia,serif; color:#C8A24A; font-size:18px; font-weight:700; margin:0 0 12px;">Reservation details</div>' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">' +
          '<tr>' +
          '<td style="padding:10px 0; font-family:Inter,Arial,sans-serif; color:#A0A0A0; font-size:13px;">Date</td>' +
          '<td style="padding:10px 0; text-align:right; font-family:Inter,Arial,sans-serif; color:#F5F5F5; font-size:13px;">' + customerDate + '</td>' +
          '</tr>' +
          '<tr>' +
          '<td style="padding:10px 0; font-family:Inter,Arial,sans-serif; color:#A0A0A0; font-size:13px;">Time</td>' +
          '<td style="padding:10px 0; text-align:right; font-family:Inter,Arial,sans-serif; color:#F5F5F5; font-size:13px;">' + customerTime + '</td>' +
          '</tr>' +
          '<tr>' +
          '<td style="padding:10px 0; font-family:Inter,Arial,sans-serif; color:#A0A0A0; font-size:13px;">Party size</td>' +
          '<td style="padding:10px 0; text-align:right; font-family:Inter,Arial,sans-serif; color:#F5F5F5; font-size:13px;">' + customerParty + '</td>' +
          '</tr>' +
          (customerNotes ? '<tr>' +
          '<td style="padding:10px 0; font-family:Inter,Arial,sans-serif; color:#A0A0A0; font-size:13px;">Notes</td>' +
          '<td style="padding:10px 0; text-align:right; font-family:Inter,Arial,sans-serif; color:#F5F5F5; font-size:13px;">' + customerNotes + '</td>' +
          '</tr>' : '') +
          '</table>' +
          '<p style="margin:18px 0 0; font-family:Inter,Arial,sans-serif; color:#A0A0A0; font-size:14px; line-height:1.6;">We’ll contact you shortly to confirm your table.</p>' +
          '<p style="margin:16px 0 0; font-family:Inter,Arial,sans-serif; color:#F5F5F5; font-size:13px; line-height:1.6;">' +
          'Address: 101 Essex St, Lawrence, MA<br/>' +
          'Phone: (978) 616-2060' +
          '</p>' +
          '<p style="margin:14px 0 0; font-family:Inter,Arial,sans-serif; color:#A0A0A0; font-size:12px; line-height:1.6;">If you have questions, just reply to this email.</p>' +
          '</td></tr>' +
          '<tr><td style="padding:18px 26px; text-align:center; color:#A0A0A0; font-family:Inter,Arial,sans-serif; font-size:12px; border-top:1px solid rgba(42,42,42,0.9);">' +
          '© 2026 Solace Brazilian Steakhouse &amp; Bar' +
          '</td></tr>' +
          '</table>' +
          '</td></tr>' +
          '</table>' +
          '</body></html>';

        var customerPayload = {
          from: resendFrom,
          to: record.email,
          subject: customerSubject,
          html: customerHtml,
          text:
            'Reservation received.\n\n' +
            'Name: ' + (record.name || '') + '\n' +
            'Date: ' + (record.reservation_date || '') + '\n' +
            'Time: ' + (record.reservation_time || '') + '\n' +
            'Party size: ' + (record.party_size || '') + '\n' +
            (record.notes ? 'Notes: ' + record.notes + '\n' : '') +
            '\nWe will contact you shortly to confirm your table.',
        };

        var customerRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + resendApiKey,
          },
          body: JSON.stringify(customerPayload),
        });

        customerOk = !!(customerRes && customerRes.ok);
        if (customerRes && !customerRes.ok) {
          var customerTxt = await customerRes.text().catch(function () { return ''; });
          console.log('Resend customer responded non-2xx:', customerRes.status, customerTxt ? customerTxt.slice(0, 500) : '');
          resendError = (resendError || '').toString();
          resendError = (customerTxt || '').slice(0, 500);
        } else {
          console.log('Resend customer email sent:', customerRes.status);
        }
      }

      // Only mark emailOk true if both manager and customer succeeded.
      emailOk = managerOk && customerOk;
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
        managerOk: managerOk,
        customerOk: customerOk,
        resendError: resendError,
      },
      reqId: reqId,
    }),
  };
};

