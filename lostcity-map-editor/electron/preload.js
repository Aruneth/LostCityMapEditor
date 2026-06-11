const { contextBridge, ipcRenderer } = require('electron')

// Expose a safe, typed API to the renderer process.
// The renderer never gets direct Node.js/fs access — all I/O goes through here.
contextBridge.exposeInMainWorld('electronAPI', {
  readFile:       (filePath)        => ipcRenderer.invoke('read-file', filePath),
  readDir:        (dirPath)         => ipcRenderer.invoke('read-dir', dirPath),
  walkDir:        (dirPath, ext)    => ipcRenderer.invoke('walk-dir', dirPath, ext),
  writeFile:      (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  showOpenDialog: (options)         => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options)         => ipcRenderer.invoke('show-save-dialog', options),
})
