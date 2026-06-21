'use strict';

const DEFAULT_CAP = 5;

async function saveImportSnapshot(Model, userId, fields, cap = DEFAULT_CAP) {
  await Model.create({ user: userId, ...fields });

  const snapshots = await Model.find({ user: userId })
    .sort({ importedAt: -1 })
    .select('_id')
    .lean();

  if (snapshots.length > cap) {
    const toDelete = snapshots.slice(cap).map(s => s._id);
    await Model.deleteMany({ _id: { $in: toDelete } });
  }
}

module.exports = { saveImportSnapshot, DEFAULT_CAP };
