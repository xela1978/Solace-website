// Server-side admin endpoint.
// Body: { adminKey: string }
// Returns: [{...reservations}]
exports.handler = async (event, context) => {
  let body = {};
  try {
    body = event && event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    body = {};
  }

  const adminKey = body.adminKey || body.key;
  const expected = process.env.RESERVATIONS_ADMIN_KEY;
  const desiredStatus = body.status || body.view || 'pending';

  if (!expected) {
    return { statusCode: 500, body: 'Missing env RESERVATIONS_ADMIN_KEY' };
  }

  if (!adminKey || adminKey !== expected) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const { getStore, connectLambda } = await import('@netlify/blobs');
  // Some Netlify runtimes require explicit initialization for Netlify Blobs.
  if (typeof connectLambda === 'function') {
    connectLambda(event);
  }
  const store = getStore({ name: 'reservations' });

  const { blobs } = await store.list({ prefix: 'reservations/' });

  const reservations = [];
  for (const b of blobs) {
    // Stored values are JSON strings.
    const v = await store.get(b.key);
    if (!v) continue;
    try {
      const parsed = typeof v === 'string' ? JSON.parse(v) : v;
      // Ensure we always have an id to allow status updates.
      // Older records might not include `id`, so we derive it from the blob key.
      if (parsed && (!parsed.id || typeof parsed.id !== 'string')) {
        var derivedId = String(b.key || '').split('/').pop();
        parsed.id = derivedId;
      }

      const currentStatus = parsed && parsed.status ? parsed.status : 'pending';
      if (currentStatus === desiredStatus) {
        reservations.push(parsed);
      }
    } catch (e) {
      // Skip invalid entries.
    }
  }

  reservations.sort(function (a, b) {
    var da = a && a.created_at ? new Date(a.created_at).getTime() : 0;
    var db = b && b.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reservations),
  };
};

