const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

function dbFilePath(app) {
    return path.join(app.getPath("userData"), "server-local-db.json");
}

async function ensureDbFile(app) {
    const filePath = dbFilePath(app);
    try {
        await fsp.access(filePath);
    } catch {
        await fsp.mkdir(path.dirname(filePath), { recursive: true });
        await fsp.writeFile(filePath, "[]", "utf8");
    }
    return filePath;
}

async function readDb(app) {
    const filePath = await ensureDbFile(app);
    const raw = await fsp.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
}

async function writeDb(app, data) {
    if (!Array.isArray(data)) {
        throw new Error("Il database deve essere un array JSON.");
    }
    const filePath = await ensureDbFile(app);
    await fsp.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
    return filePath;
}

module.exports = {
    dbFilePath,
    ensureDbFile,
    readDb,
    writeDb
};
