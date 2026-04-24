const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");

function defaultDatasource() {
    return {
        mode: "local",
        httpUrl: "",
        httpToken: "",
        remoteUrl: "",
        ftpHost: "",
        ftpPort: "21",
        ftpUser: "",
        ftpPass: "",
        ftpPath: "/database.json",
        ftpTls: false,
        gdriveToken: "",
        gdriveFileId: "",
        dropboxToken: "",
        dropboxPath: "/BB-Inventor/database.json",
        onedriveToken: "",
        onedrivePath: "BB-Inventor/database.json",
        uncPath: ""
    };
}

function datasourcePath(app) {
    return path.join(app.getPath("userData"), "server-datasource.json");
}

function localDbPath(app) {
    return path.join(app.getPath("userData"), "server-local-db.json");
}

function normalizeDatasource(raw) {
    return { ...defaultDatasource(), ...(raw || {}) };
}

function loadPersistedDatasource(app) {
    try {
        const raw = JSON.parse(fs.readFileSync(datasourcePath(app), "utf8"));
        return normalizeDatasource(raw);
    } catch {
        return defaultDatasource();
    }
}

async function savePersistedDatasource(app, datasource) {
    const next = normalizeDatasource(datasource);
    await fsp.mkdir(path.dirname(datasourcePath(app)), { recursive: true });
    await fsp.writeFile(datasourcePath(app), JSON.stringify(next, null, 2), "utf8");
    return next;
}

async function loadPersistedDb(app) {
    try {
        const raw = JSON.parse(await fsp.readFile(localDbPath(app), "utf8"));
        return Array.isArray(raw) ? raw : [];
    } catch (err) {
        if (err.code === "ENOENT") return [];
        throw err;
    }
}

async function savePersistedDb(app, data) {
    if (!Array.isArray(data)) {
        throw new Error("Il database deve essere un array JSON.");
    }
    await fsp.mkdir(path.dirname(localDbPath(app)), { recursive: true });
    await fsp.writeFile(localDbPath(app), JSON.stringify(data, null, 2), "utf8");
    return true;
}

function getLocalHosts() {
    const hosts = new Set(["127.0.0.1", "localhost", "::1"]);
    const nets = os.networkInterfaces();
    for (const entries of Object.values(nets)) {
        for (const entry of entries || []) {
            if (entry && entry.address) hosts.add(entry.address);
        }
    }
    return hosts;
}

function isSelfHttpDatasource(datasource, localPort) {
    try {
        const url = new URL(datasource.httpUrl || "");
        const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
        return getLocalHosts().has(url.hostname) && port === Number(localPort || 3001);
    } catch {
        return false;
    }
}

async function httpGetJson(url, token) {
    const headers = token ? { Authorization: "Bearer " + token } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
}

async function httpPutJson(url, data, token) {
    const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {})
    };
    const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(data, null, 2)
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return true;
}

async function gdriveLoad(datasource) {
    const fileId = String(datasource.gdriveFileId || "").trim();
    if (!fileId) return [];
    const res = await fetch("https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media", {
        headers: { Authorization: "Bearer " + datasource.gdriveToken }
    });
    if (!res.ok) throw new Error("Google Drive GET " + res.status);
    return res.json();
}

async function gdriveSave(datasource, data) {
    const fileId = String(datasource.gdriveFileId || "").trim();
    if (!fileId) throw new Error("File ID Google Drive mancante.");
    const boundary = "bbinventorboundary";
    const metadata = JSON.stringify({ name: "database.json", mimeType: "application/json" });
    const json = JSON.stringify(data, null, 2);
    const body = [
        "--" + boundary,
        "Content-Type: application/json; charset=UTF-8",
        "",
        metadata,
        "--" + boundary,
        "Content-Type: application/json; charset=UTF-8",
        "",
        json,
        "--" + boundary + "--"
    ].join("\r\n");

    const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files/" + fileId + "?uploadType=multipart",
        {
            method: "PATCH",
            headers: {
                Authorization: "Bearer " + datasource.gdriveToken,
                "Content-Type": "multipart/related; boundary=" + boundary
            },
            body
        }
    );
    if (!res.ok) throw new Error("Google Drive PATCH " + res.status);
    return true;
}

async function dropboxLoad(datasource) {
    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + datasource.dropboxToken,
            "Dropbox-API-Arg": JSON.stringify({ path: datasource.dropboxPath || "/BB-Inventor/database.json" })
        }
    });
    if (!res.ok) throw new Error("Dropbox GET " + res.status);
    return res.json();
}

async function dropboxSave(datasource, data) {
    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + datasource.dropboxToken,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({
                path: datasource.dropboxPath || "/BB-Inventor/database.json",
                mode: "overwrite",
                autorename: false,
                mute: true
            })
        },
        body: JSON.stringify(data, null, 2)
    });
    if (!res.ok) throw new Error("Dropbox PUT " + res.status);
    return true;
}

async function onedriveLoad(datasource) {
    const filePath = encodeURIComponent(datasource.onedrivePath || "BB-Inventor/database.json").replace(/%2F/g, "/");
    const res = await fetch("https://graph.microsoft.com/v1.0/me/drive/root:/" + filePath + ":/content", {
        headers: { Authorization: "Bearer " + datasource.onedriveToken }
    });
    if (!res.ok) throw new Error("OneDrive GET " + res.status);
    return res.json();
}

async function onedriveSave(datasource, data) {
    const filePath = encodeURIComponent(datasource.onedrivePath || "BB-Inventor/database.json").replace(/%2F/g, "/");
    const res = await fetch("https://graph.microsoft.com/v1.0/me/drive/root:/" + filePath + ":/content", {
        method: "PUT",
        headers: {
            Authorization: "Bearer " + datasource.onedriveToken,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data, null, 2)
    });
    if (!res.ok) throw new Error("OneDrive PUT " + res.status);
    return true;
}

async function uncLoad(datasource) {
    const raw = await fsp.readFile(datasource.uncPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
}

async function uncSave(datasource, data) {
    await fsp.mkdir(path.dirname(datasource.uncPath), { recursive: true });
    await fsp.writeFile(datasource.uncPath, JSON.stringify(data, null, 2), "utf8");
    return true;
}

async function readServerDatabase(app, localPort) {
    const datasource = loadPersistedDatasource(app);

    switch (datasource.mode) {
        case "local":
            return loadPersistedDb(app);
        case "http":
            if (isSelfHttpDatasource(datasource, localPort)) {
                return loadPersistedDb(app);
            }
            return httpGetJson((datasource.httpUrl || "").replace(/\/$/, "") + "/db", datasource.httpToken);
        case "remoteurl": {
            const res = await fetch(datasource.remoteUrl);
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        }
        case "gdrive":
            return gdriveLoad(datasource);
        case "dropbox":
            return dropboxLoad(datasource);
        case "onedrive":
            return onedriveLoad(datasource);
        case "electron-unc":
            return uncLoad(datasource);
        case "ftp":
            throw new Error("FTP non supportato dal server integrato.");
        default:
            return loadPersistedDb(app);
    }
}

async function writeServerDatabase(app, localPort, data) {
    const datasource = loadPersistedDatasource(app);

    switch (datasource.mode) {
        case "local":
            return savePersistedDb(app, data);
        case "http":
            if (isSelfHttpDatasource(datasource, localPort)) {
                return savePersistedDb(app, data);
            }
            return httpPutJson((datasource.httpUrl || "").replace(/\/$/, "") + "/db", data, datasource.httpToken);
        case "remoteurl":
            throw new Error("URL remoto in sola lettura.");
        case "gdrive":
            return gdriveSave(datasource, data);
        case "dropbox":
            return dropboxSave(datasource, data);
        case "onedrive":
            return onedriveSave(datasource, data);
        case "electron-unc":
            return uncSave(datasource, data);
        case "ftp":
            throw new Error("FTP non supportato dal server integrato.");
        default:
            return savePersistedDb(app, data);
    }
}

module.exports = {
    loadPersistedDatasource,
    savePersistedDatasource,
    loadPersistedDb,
    savePersistedDb,
    readServerDatabase,
    writeServerDatabase,
    localDbPath
};
