// Update reservation status by id (pending <-> processed)
// Body: { adminKey: string, id: string, status: "pending" | "processed" }
exports.handler = async (event, context) => {
  let body = {};
  try {
    body = event && event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    body = {};
  }

  const adminKey = body.adminKey || body.key;
  const expected = process.env.RESERVATIONS_ADMIN_KEY;
  const id = body.id;
  const status = body.status;

  if (!expected) {
    return { statusCode: 500, body: 'Missing env RESERVATIONS_ADMIN_KEY' };
  }

  if (!adminKey || adminKey !== expected) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  if (!id) {
    return { statusCode: 400, body: 'Missing id' };
  }

  const normalized = status === 'processed' ? 'processed' : 'pending';

  const { getStore, connectLambda } = await import('@netlify/blobs');
  if (typeof connectLambda === 'function') {
    connectLambda(event);
  }
  const store = getStore({ name: 'reservations' });

  const key = `reservations/${id}`;
  const v = await store.get(key);
  if (!v) {
    return { statusCode: 404, body: 'Not found' };
  }

  let record = v;
  try {
    record = typeof v === 'string' ? JSON.parse(v) : v;
  } catch (e) {
    record = v;
  }

  record.status = normalized;
  record.updated_at = new Date().toISOString();

  await store.set(key, JSON.stringify(record));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, status: normalized, id: id }),
  };
};

