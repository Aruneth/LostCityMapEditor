const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs/promises')

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'Lost City Map Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.handle('read-file', async (_, filePath) => {
  const buffer = await fs.readFile(filePath)
  // Return a plain ArrayBuffer so it can be transferred via IPC
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
})

ipcMain.handle('read-dir', async (_, dirPath) => {
  return fs.readdir(dirPath)
})

ipcMain.handle('write-file', async (_, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf8')
})

ipcMain.handle('show-open-dialog', async (_, options) => {
  return dialog.showOpenDialog(options)
})

ipcMain.handle('show-save-dialog', async (_, options) => {
  return dialog.showSaveDialog(options)
})

// Recursively list all file paths under dirPath, optionally filtered by extension (e.g. '.flo').
ipcMain.handle('walk-dir', async (_, dirPath, ext) => {
  const results = []
  async function walk(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (!ext || entry.name.toLowerCase().endsWith(ext)) {
        results.push(full)
      }
    }
  }
  await walk(dirPath)
  return results
})
