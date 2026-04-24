const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const KEEP_LINES_ON_ROTATE = 3000;

function logDir(app) {
    return path.join(app.getPath("userData"), "logs");
}

function logFilePath(app) {
    return path.join(logDir(app), "app.log");
}

async function ensureLogFile(app) {
    const dir = logDir(app);
    await fsp.mkdir(dir, { recursive: true });
    const file = logFilePath(app);
    try {
        await fsp.access(file);
    } catch {
        await fsp.writeFile(file, "", "utf8");
    }
    return file;
}

function formatLine(level, message, meta) {
    const ts = new Date().toISOString();
    const suffix = meta ? " " + JSON.stringify(meta) : "";
    return `[${ts}] [${String(level || "INFO").toUpperCase()}] ${String(message || "")}${suffix}\n`;
}

async function rotateIfNeeded(app) {
    const file = await ensureLogFile(app);
    const stat = await fsp.stat(file);
    if (stat.size <= MAX_LOG_BYTES) return file;

    const raw = await fsp.readFile(file, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const trimmed = lines.slice(-KEEP_LINES_ON_ROTATE).join("\n") + "\n";
    await fsp.writeFile(file, trimmed, "utf8");
    return file;
}

async function writeLog(app, level, message, meta = null) {
    const file = await ensureLogFile(app);
    await rotateIfNeeded(app);
    await fsp.appendFile(file, formatLine(level, message, meta), "utf8");
    return file;
}

async function readLogTail(app, maxLines = 300) {
    const file = await ensureLogFile(app);
    const raw = await fsp.readFile(file, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return {
        filePath: file,
        totalLines: lines.length,
        lines: lines.slice(-Math.max(1, Number(maxLines) || 300))
    };
}

async function clearLog(app) {
    const file = await ensureLogFile(app);
    await fsp.writeFile(file, "", "utf8");
    return file;
}

module.exports = {
    logFilePath,
    ensureLogFile,
    writeLog,
    readLogTail,
    clearLog
};