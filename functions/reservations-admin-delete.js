// Delete a reservation blob by id (stored key: reservations/{id})
// Body: { adminKey: string, id: string }
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

  if (!expected) {
    return { statusCode: 500, body: 'Missing env RESERVATIONS_ADMIN_KEY' };
  }

  if (!adminKey || adminKey !== expected) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  if (!id) {
    return { statusCode: 400, body: 'Missing id' };
  }

  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name: 'reservations' });

  const key = `reservations/${id}`;
  await store.delete(key);

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deleted: true, id }) };
};

