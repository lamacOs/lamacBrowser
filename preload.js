const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("browser", {
  newTab: url => ipcRenderer.invoke("browser:new-tab", url),
  activateTab: id => ipcRenderer.invoke("browser:activate-tab", id),
  closeTab: id => ipcRenderer.invoke("browser:close-tab", id),
  navigate: url => ipcRenderer.invoke("browser:navigate", url),
  back: () => ipcRenderer.invoke("browser:back"),
  forward: () => ipcRenderer.invoke("browser:forward"),
  reload: () => ipcRenderer.invoke("browser:reload"),
  toggleBookmark: () =>
    ipcRenderer.invoke("browser:toggle-bookmark"),
  openBookmark: url =>
    ipcRenderer.invoke("browser:open-bookmark", url),

  onState(callback) {
    const listener = (_, state) => callback(state);
    ipcRenderer.on("browser:state", listener);

    return () => {
      ipcRenderer.removeListener("browser:state", listener);
    };
  }
});
