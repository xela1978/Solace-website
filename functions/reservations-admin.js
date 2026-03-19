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

  if (!expected) {
    return { statusCode: 500, body: 'Missing env RESERVATIONS_ADMIN_KEY' };
  }

  if (!adminKey || adminKey !== expected) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name: 'reservations' });

  const { blobs } = await store.list({ prefix: 'reservations/' });

  const reservations = [];
  for (const b of blobs) {
    // Stored values are JSON strings.
    const v = await store.get(b.key);
    if (!v) continue;
    try {
      const parsed = typeof v === 'string' ? JSON.parse(v) : v;
      reservations.push(parsed);
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

