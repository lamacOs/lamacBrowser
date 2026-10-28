const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain
} = require("electron");

const path = require("node:path");
const fs = require("node:fs/promises");

let win;
let nextId = 1;
let activeId = null;

const tabs = new Map();
let bookmarks = [];

const TOOLBAR_HEIGHT = 142;

function normalizeURL(input) {
  input = String(input || "").trim();

  if (!input) return "https://www.google.com";

  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.href;
      }
    } catch {}
  }

  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/i.test(input)) {
    return "https://" + input;
  }

  return "https://www.google.com/search?q=" +
    encodeURIComponent(input);
}

function sendState() {
  if (!win || win.isDestroyed()) return;

  const list = [...tabs.values()].map(tab => ({
    id: tab.id,
    title: tab.title || "Neuer Tab",
    url: tab.url,
    active: tab.id === activeId
  }));

  const active = tabs.get(activeId);

  win.webContents.send("browser:state", {
    tabs: list,
    activeId,
    url: active?.url || "",
    canGoBack: active?.view.webContents.navigationHistory
      .canGoBack() || false,
    canGoForward: active?.view.webContents.navigationHistory
      .canGoForward() || false,
    bookmarks
  });
}

function layoutViews() {
  if (!win) return;

  const { width, height } = win.getContentBounds();

  for (const tab of tabs.values()) {
    tab.view.setBounds({
      x: 0,
      y: TOOLBAR_HEIGHT,
      width,
      height: Math.max(0, height - TOOLBAR_HEIGHT)
    });

    tab.view.setVisible(tab.id === activeId);
  }
}

async function saveBookmarks() {
  const file = path.join(app.getPath("userData"), "bookmarks.json");
  await fs.writeFile(file, JSON.stringify(bookmarks, null, 2));
}

async function loadBookmarks() {
  const file = path.join(app.getPath("userData"), "bookmarks.json");

  try {
    bookmarks = JSON.parse(await fs.readFile(file, "utf8"));
    if (!Array.isArray(bookmarks)) bookmarks = [];
  } catch {
    bookmarks = [];
  }
}

async function createTab(input = "https://www.google.com") {
  const id = nextId++;

  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  const tab = {
    id,
    view,
    url: normalizeURL(input),
    title: "Lade Website …"
  };

  tabs.set(id, tab);
  win.contentView.addChildView(view);

  view.webContents.setWindowOpenHandler(({ url }) => {
    createTab(url);
    return { action: "deny" };
  });

  view.webContents.on("will-navigate", (event, url) => {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  const update = () => {
    tab.url = view.webContents.getURL() || tab.url;
    tab.title = view.webContents.getTitle() || "Website";
    sendState();
  };

  view.webContents.on("did-navigate", update);
  view.webContents.on("did-navigate-in-page", update);
  view.webContents.on("page-title-updated", update);
  view.webContents.on("did-finish-load", update);

  activeId = id;
  layoutViews();
  sendState();

  try {
    await view.webContents.loadURL(tab.url);
  } catch (error) {
    console.error("Website konnte nicht geladen werden:", error);
  }

  return id;
}

function getActiveTab() {
  return tabs.get(activeId);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 650,
    minHeight: 450,
    backgroundColor: "#0b1120",
    title: "lamacBrowser",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile("index.html");

  win.on("resize", layoutViews);

  win.webContents.on("did-finish-load", async () => {
    await createTab();
  });

  win.on("closed", () => {
    win = null;
    tabs.clear();
    activeId = null;
  });
}

ipcMain.handle("browser:new-tab", (_, url) => createTab(url));

ipcMain.handle("browser:activate-tab", (_, id) => {
  if (!tabs.has(id)) return;
  activeId = id;
  layoutViews();
  sendState();
});

ipcMain.handle("browser:close-tab", (_, id) => {
  const tab = tabs.get(id);
  if (!tab) return;

  win.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  tabs.delete(id);

  if (activeId === id) {
    activeId = [...tabs.keys()].at(-1) ?? null;
  }

  if (activeId === null) createTab();
  else {
    layoutViews();
    sendState();
  }
});

ipcMain.handle("browser:navigate", async (_, input) => {
  const tab = getActiveTab();
  if (!tab) return;

  const url = normalizeURL(input);
  tab.url = url;
  sendState();

  try {
    await tab.view.webContents.loadURL(url);
  } catch (error) {
    console.error(error);
  }
});

ipcMain.handle("browser:back", () => {
  const wc = getActiveTab()?.view.webContents;
  if (wc?.navigationHistory.canGoBack()) {
    wc.navigationHistory.goBack();
  }
});

ipcMain.handle("browser:forward", () => {
  const wc = getActiveTab()?.view.webContents;
  if (wc?.navigationHistory.canGoForward()) {
    wc.navigationHistory.goForward();
  }
});

ipcMain.handle("browser:reload", () => {
  getActiveTab()?.view.webContents.reload();
});

ipcMain.handle("browser:toggle-bookmark", async () => {
  const tab = getActiveTab();
  if (!tab?.url) return;

  const index = bookmarks.findIndex(item => item.url === tab.url);

  if (index >= 0) {
    bookmarks.splice(index, 1);
  } else {
    bookmarks.push({
      title: tab.title || tab.url,
      url: tab.url
    });
  }

  await saveBookmarks();
  sendState();
});

ipcMain.handle("browser:open-bookmark", (_, url) => {
  createTab(url);
});

app.whenReady().then(async () => {
  await loadBookmarks();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
