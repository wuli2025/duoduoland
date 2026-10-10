const fs = require('node:fs');
const path = require('node:path');
const directory = path.join(__dirname, '../docs/evals/round-6');

// Keep one reviewable scenario per file, containing only report evidence.
function rowSummary(row) {
  return { id: row.id, public: { profile: {
    name: row.public.profile.name, title: row.public.profile.title
  } }, score: row.score, factors: {
    needAB: row.factors.needAB, needBA: row.factors.needBA
  }, reason: row.reason };
}
function save(record) {
  fs.mkdirSync(directory, { recursive: true });
  const scenarios = record.scenarios.map((entry, index) => {
    const filename = `${String(index + 1).padStart(2, '0')}.json`;
    const summary = { ...entry, local: entry.local.map(rowSummary) };
    if (entry.remote) summary.remote = entry.remote.map(rowSummary);
    fs.writeFileSync(path.join(directory, filename), JSON.stringify(summary, null, 2) + '\n');
    return filename;
  });
  fs.writeFileSync(path.join(directory, 'index.json'),
    JSON.stringify({ ...record, scenarios }, null, 2) + '\n');
}
function load() {
  const record = JSON.parse(fs.readFileSync(path.join(directory, 'index.json'), 'utf8'));
  record.scenarios = record.scenarios.map(name =>
    JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
  return record;
}
module.exports = { save, load };
