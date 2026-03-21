/**
 * One-off: send the review-followup email template to a test address.
 * Usage (PowerShell):
 *   $env:RESEND_API_KEY="re_xxxx"; $env:RESEND_FROM_EMAIL="Solace <onboarding@resend.dev>"; node scripts/send-review-email-test.js agv1.biz@gmail.com
 */
const DEFAULT_TO = 'agv1.biz@gmail.com';
const REVIEW_URL = 'https://solacebraziliansteakhouse.com/review';

const to = process.argv[2] || DEFAULT_TO;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL;

const guestName = 'Guest';

const html =
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
  REVIEW_URL +
  '" style="display:inline-block; padding:14px 28px; background:#C8A24A; color:#0A0A0A; font-family:Inter,Arial,sans-serif; font-size:15px; font-weight:700; text-decoration:none; border-radius:14px;">Leave a Google review</a>' +
  '</p>' +
  '<p style="margin:20px 0 0; font-family:Inter,Arial,sans-serif; color:#A0A0A0; font-size:13px; line-height:1.6;">101 Essex St, Lawrence, MA · (978) 616-2060</p>' +
  '</td></tr>' +
  '<tr><td style="padding:18px 26px; text-align:center; color:#A0A0A0; font-family:Inter,Arial,sans-serif; font-size:12px; border-top:1px solid rgba(42,42,42,0.9);">' +
  '© Solace Brazilian Steakhouse &amp; Bar · TEST EMAIL' +
  '</td></tr>' +
  '</table></td></tr></table></body></html>';

const text =
  '[TEST] Thank you for dining at Solace Brazilian Steakhouse & Bar.\n\n' +
  'We would be grateful if you could leave a short review on Google:\n' +
  REVIEW_URL +
  '\n\n101 Essex St, Lawrence, MA · (978) 616-2060';

async function main() {
  if (!resendApiKey || !resendFrom) {
    console.error('Missing RESEND_API_KEY or RESEND_FROM_EMAIL.');
    console.error('Copy them from Netlify → Site settings → Environment variables, then run:');
    console.error('  $env:RESEND_API_KEY="re_..."; $env:RESEND_FROM_EMAIL="Name <verified@yourdomain.com>"; node scripts/send-review-email-test.js');
    process.exit(1);
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + resendApiKey,
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [to],
      subject: '[TEST] How was your visit at Solace?',
      html,
      text,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error('Resend error', res.status, body);
    process.exit(1);
  }
  console.log('Sent test email to', to);
  try {
    console.log(JSON.parse(body));
  } catch (e) {
    console.log(body);
  }
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
