const { contextBridge, ipcRenderer } = require('electron')

// Expose a safe, typed API to the renderer process.
// The renderer never gets direct Node.js/fs access — all I/O goes through here.
contextBridge.exposeInMainWorld('electronAPI', {
  readFile:       (filePath)          => ipcRenderer.invoke('read-file', filePath),
  readDir:        (dirPath)           => ipcRenderer.invoke('read-dir', dirPath),
  walkDir:        (dirPath, ext)      => ipcRenderer.invoke('walk-dir', dirPath, ext),
  writeFile:      (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  showOpenDialog: (options)           => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options)           => ipcRenderer.invoke('show-save-dialog', options),

  // World map support
  setServerDir:   (dir)  => ipcRenderer.invoke('set-server-dir', dir),
  getMapList:          ()        => ipcRenderer.invoke('get-map-list'),
  getMinimapColors:    (mapName) => ipcRenderer.invoke('get-minimap', mapName),
  openWorldMap:   ()     => ipcRenderer.send('open-world-map'),
  openMap:        (name) => ipcRenderer.send('open-map', name),
  onLoadMap:       (cb)  => ipcRenderer.on('load-map', (_, name) => cb(name)),
  onLoadRadius:    (cb)  => ipcRenderer.on('set-load-radius', (_, r) => cb(r)),
  onOpenBuildTool: (cb)  => ipcRenderer.on('open-build-tool', (_, tool) => cb(tool)),
})
