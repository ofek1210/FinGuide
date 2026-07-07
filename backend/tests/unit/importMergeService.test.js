

const { norm, upsertImportedRecords } = require('../../services/importMergeService');

function createInMemoryModel(initial = []) {
  const store = initial.map((r, i) => ({ ...r, _id: r._id || `id-${i}` }));

  return {
    find: jest.fn(query => ({
      lean: async () => store.filter(r => {
        if (query.user && String(r.user) !== String(query.user)) return false;
        if (query.status?.$ne && r.status === query.status.$ne) return false;
        return true;
      }),
    })),
    updateOne: jest.fn(async (query, { $set }) => {
      const idx = store.findIndex(r => String(r._id) === String(query._id));
      if (idx >= 0) store[idx] = { ...store[idx], ...$set };
    }),
    create: jest.fn(async doc => {
      const record = { _id: `id-${store.length}`, ...doc };
      store.push(record);
      return record;
    }),
    deleteMany: jest.fn(async query => {
      const ids = new Set((query._id?.$in || []).map(String));
      for (let i = store.length - 1; i >= 0; i -= 1) {
        if (ids.has(String(store[i]._id)) && String(store[i].user) === String(query.user)) {
          store.splice(i, 1);
        }
      }
    }),
    _store: store,
  };
}

describe('importMergeService', () => {
  it('norm trims and lowercases strings', () => {
    expect(norm('  ABC ')).toBe('abc');
    expect(norm(null)).toBe('');
  });

  it('upsertImportedRecords creates, merges, and deletes stale import records', async () => {
    const userId = 'user-1';
    const Model = createInMemoryModel([
      { _id: 'old-1', user: userId, source: 'har_bituach', key: 'a', status: 'active' },
      { _id: 'manual-1', user: userId, source: 'manual', key: 'm', status: 'active' },
    ]);

    const result = await upsertImportedRecords({
      Model,
      userId,
      items: [{ key: 'b', source: 'har_bituach', status: 'active' }],
      mergeKeyFn: r => r.key,
      buildCreatePayload: incoming => ({ ...incoming, user: userId }),
      mergeRecordFn: (existing, incoming) => ({ ...existing, ...incoming }),
      findStale: (record, importKeys) =>
        record.source === 'har_bituach' && !importKeys.has(record.key),
      listFilter: { status: { $ne: 'cancelled' } },
    });

    expect(result.created).toBe(1);
    expect(result.records).toHaveLength(2);
    expect(result.records.some(r => r.key === 'b')).toBe(true);
    expect(result.records.some(r => r.key === 'm')).toBe(true);
    expect(result.records.some(r => r.key === 'a')).toBe(false);
    expect(Model.deleteMany).toHaveBeenCalled();
  });

  it('upsertImportedRecords merges existing records by key', async () => {
    const userId = 'user-2';
    const Model = createInMemoryModel([
      { _id: 'rec-1', user: userId, source: 'har_bituach', key: 'x', premium: 100, status: 'active' },
    ]);

    const result = await upsertImportedRecords({
      Model,
      userId,
      items: [{ key: 'x', source: 'har_bituach', premium: 150, status: 'active' }],
      mergeKeyFn: r => r.key,
      buildCreatePayload: incoming => ({ ...incoming, user: userId }),
      mergeRecordFn: (existing, incoming) => ({ ...existing, premium: incoming.premium }),
      findStale: (record, importKeys) =>
        record.source === 'har_bituach' && !importKeys.has(record.key),
    });

    expect(result.merged).toBe(1);
    expect(result.created).toBe(0);
    expect(result.records[0].premium).toBe(150);
  });
});
