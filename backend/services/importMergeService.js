

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

/**
 * Generic upsert for imported domain records (funds, policies).
 */
async function upsertImportedRecords({
  Model,
  userId,
  items,
  mergeKeyFn,
  buildCreatePayload,
  mergeRecordFn,
  findStale,
  listFilter = {},
}) {
  const existingAll = await Model.find({ user: userId, ...listFilter }).lean();
  const existingByKey = new Map(existingAll.map(r => [mergeKeyFn(r), r]));
  const importKeys = new Set();
  let merged = 0;
  let created = 0;

  for (const incoming of items) {
    const key = mergeKeyFn(incoming);
    importKeys.add(key);
    const payload = buildCreatePayload(incoming);

    const existing = existingByKey.get(key);
    if (existing) {
      const mergedFields = mergeRecordFn(existing, payload);
      await Model.updateOne({ _id: existing._id }, { $set: mergedFields });
      merged += 1;
    } else {
      await Model.create(payload);
      created += 1;
    }
  }

  const staleIds = existingAll
    .filter(r => findStale(r, importKeys))
    .map(r => r._id);

  if (staleIds.length) {
    await Model.deleteMany({ _id: { $in: staleIds }, user: userId });
  }

  const records = await Model.find({ user: userId, ...listFilter }).lean();
  return { records, imported: items.length, merged, created };
}

module.exports = { norm, upsertImportedRecords };
