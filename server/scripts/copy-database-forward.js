require('dotenv').config();
const mongoose = require('mongoose');

const targetName = process.env.NEXUSLEARN_DB_NAME || 'nexuslearn';
const sourceUri = process.env.SOURCE_MONGODB_URI || process.env.MONGODB_URI;

async function copyDatabaseForward() {
  if (!sourceUri) throw new Error('Set SOURCE_MONGODB_URI to the currently used database URI.');
  const connection = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 10_000 }).asPromise();
  try {
    const sourceDb = connection.db;
    if (!sourceDb || sourceDb.databaseName === targetName) throw new Error('Source and target database must be different.');
    const targetDb = connection.useDb(targetName).db;
    if (!targetDb) throw new Error('Could not select the target database.');
    const collections = await sourceDb.listCollections({}, { nameOnly: false }).toArray();
    const summary = [];

    for (const descriptor of collections) {
      if (descriptor.type === 'view' || descriptor.name.startsWith('system.')) continue;
      const source = sourceDb.collection(descriptor.name);
      const target = targetDb.collection(descriptor.name);
      let copied = 0;
      const operations = [];
      for await (const document of source.find({}).batchSize(250)) {
        operations.push({ updateOne: { filter: { _id: document._id }, update: { $setOnInsert: document }, upsert: true } });
        if (operations.length === 250) {
          const result = await target.bulkWrite(operations, { ordered: false });
          copied += result.upsertedCount;
          operations.length = 0;
        }
      }
      if (operations.length) {
        const result = await target.bulkWrite(operations, { ordered: false });
        copied += result.upsertedCount;
      }

      const indexes = await source.listIndexes().toArray();
      for (const index of indexes) {
        if (index.name === '_id_') continue;
        const { key, name, ...options } = index;
        delete options.ns;
        delete options.v;
        await target.createIndex(key, { ...options, name });
      }
      const sourceCount = await source.countDocuments();
      const targetCount = await target.countDocuments();
      if (targetCount < sourceCount) throw new Error(`Verification failed for collection ${descriptor.name}.`);
      summary.push({ collection: descriptor.name, sourceCount, targetCount, copied });
    }
    console.table(summary);
    console.log(`Copy-forward complete. Source database "${sourceDb.databaseName}" is unchanged; target is "${targetName}".`);
    console.log('Only update MONGODB_URI to the target database after reviewing the counts above.');
  } finally {
    await connection.close();
  }
}

copyDatabaseForward().catch((error) => {
  console.error('Copy-forward migration failed:', error.message);
  process.exitCode = 1;
});
