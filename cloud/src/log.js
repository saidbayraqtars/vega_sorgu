// Basit yapılandırılmış günlük (stdout → docker logs / journald).
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
let min = LEVELS.info;

function setLevel(l) { min = LEVELS[l] || LEVELS.info; }
function out(level, msg, extra) {
  if (LEVELS[level] < min) return;
  const line = { t: new Date().toISOString(), l: level, m: msg, ...(extra || {}) };
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(`${JSON.stringify(line)}\n`);
}

module.exports = {
  setLevel,
  debug: (m, e) => out("debug", m, e),
  info: (m, e) => out("info", m, e),
  warn: (m, e) => out("warn", m, e),
  error: (m, e) => out("error", m, e),
};
