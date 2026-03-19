// Triggered automatically by Netlify when a verified form submission is created.
// We persist reservation submissions so an admin page can list them.
exports.handler = async (event, context) => {
  let payload;
  try {
    payload = JSON.parse(event.body).payload;
  } catch (e) {
    return { statusCode: 200, body: 'No payload' };
  }

  const wantedFormName = process.env.RESERVATIONS_FORM_NAME || 'reservations';
  const formName = payload && (payload.form_name || payload.formName);
  if (!formName || formName !== wantedFormName) {
    return { statusCode: 200, body: 'Ignored' };
  }

  const d = (payload && payload.data) ? payload.data : {};

  // Map our HTML field names -> stored record fields.
  const record = {
    id: payload.id || '',
    created_at: payload.created_at || '',
    form_name: formName,
    name: d.full_name || d.name || '',
    email: d.email || '',
    phone: d.phone || '',
    reservation_date: d.reservation_date || '',
    reservation_time: d.reservation_time || '',
    party_size: d.party_size || '',
    notes: d.notes || '',
  };

  // Always generate an id/key so we can include it in emails even if blob persistence fails.
  const reservationId = record.id || record.created_at || String(Date.now());
  record.id = reservationId;
  const key = `reservations/${reservationId}`;

  const { getStore, connectLambda } = await import('@netlify/blobs');
  // Some Netlify runtimes require explicit initialization for Netlify Blobs.
  if (typeof connectLambda === 'function') {
    connectLambda(event);
  }
  const store = getStore({ name: 'reservations' });

  try {
    await store.set(key, JSON.stringify(record));
  } catch (e) {
    // Do not block email sending if storage is misconfigured locally.
    console.log('Reservation blob save failed:', e && e.message ? e.message : e);
  }

  // Optional: send email via external webhook (free on many providers).
  // If RESERVATIONS_EMAIL_WEBHOOK_URL is set, we POST the reservation JSON to it.
  // This avoids relying on Netlify paid "Form submission notifications".
  const webhookUrl = process.env.RESERVATIONS_EMAIL_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(function () { controller.abort(); }, 8000);

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reservation_created',
          reservation: record,
          // Minimal extra context that can help formatting/debugging in the webhook.
          form_name: formName,
          submission_id: payload.id || '',
          created_at: payload.created_at || record.created_at || '',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
    } catch (e) {
      // Never block the form submission if the webhook fails.
      // You can inspect logs to troubleshoot.
      console.log('Reservation webhook failed:', e && e.message ? e.message : e);
    }
  }

  // Optional: send email via Resend API (instead of paid Netlify notifications).
  // Env vars:
  // - RESEND_API_KEY
  // - RESEND_TO_EMAIL (manager email)
  // - RESEND_FROM_EMAIL (must be verified in Resend)
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendTo = process.env.RESEND_TO_EMAIL;
  const resendFrom = process.env.RESEND_FROM_EMAIL;

  if (resendApiKey && resendTo && resendFrom) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(function () { controller.abort(); }, 8000);

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

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + resendApiKey,
        },
        body: JSON.stringify((function () {
          var payload = {
            from: resendFrom,
            to: resendTo,
            subject: subject,
            text: text,
          };

          // Let the manager reply directly to the guest email.
          if (record.email) {
            payload.reply_to = record.email;
          }

          return payload;
        })()),
        signal: controller.signal,
      });

      clearTimeout(timeout);
    } catch (e) {
      // Never block form submission if email fails.
      console.log('Resend email failed:', e && e.message ? e.message : e);
    }
  }

  return { statusCode: 200, body: 'Saved' };
};

