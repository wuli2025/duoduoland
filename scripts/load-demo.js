const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
module.exports = function load(extra = {}) {
  const context = { window: {}, ...extra };
  vm.createContext(context);
  const files = ['config/app', 'config/dating', 'config/intent', 'config/fields', 'config/copy', 'data/profile',
    'data/events', 'data/people-catalog', 'data/people', 'data/ai-people', 'data/dating-people', 'data/job-details', 'data/jobs', 'core/store', 'core/service'];
  for (const file of files) vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../src', file + '.js'), 'utf8'), context);
  const BJ = context.window.BJ;
  BJ.intentTools = require('../src/core/intent-tools');
  BJ.dating = require('../src/core/dating');
  BJ.datingSettings = require('../src/core/dating-settings');
  for (const name of ['matching', 'synonyms', 'reasons', 'llm']) {
    BJ.config[name] = require('../src/config/' + name + '.js');
  }
  const engine = require('../src/core/matcher.js').create(BJ.config);
  return { ...BJ, engine, context };
};
