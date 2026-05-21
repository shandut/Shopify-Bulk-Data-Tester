const fs = require('fs').promises;
const path = require('path');

const ENV_FILE_PATH = path.join(process.cwd(), '.env');

const parseEnv = (content) => {
  const values = {};

  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  });

  return values;
};

const serializeEnv = (values) => {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('\n') + '\n';
};

const readEnv = async () => {
  try {
    const content = await fs.readFile(ENV_FILE_PATH, 'utf8');
    return parseEnv(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
};

const writeEnv = async (updates) => {
  const current = await readEnv();
  const next = {
    ...current,
    ...updates
  };

  await fs.writeFile(ENV_FILE_PATH, serializeEnv(next));

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      process.env[key] = String(value);
    }
  });

  return next;
};

module.exports = {
  readEnv,
  writeEnv
};
