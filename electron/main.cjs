'use strict';

const { app, BrowserWindow, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { pathToFileURL } = require('url');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.logger = null;

autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización lista',
    message: `Versión ${info.version} descargada. ¿Reiniciar para instalar?`,
    buttons: ['Reiniciar ahora', 'Más tarde'],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', (err) => {
  console.error('[updater]', err.message);
});

const PORT = 3001;
let mainWindow = null;

function waitForServer() {
  return new Promise((resolve) => {
    let attempts = 0;
    function check() {
      if (attempts++ > 60) { resolve(); return; }
      http.get(`http://localhost:${PORT}/api/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else setTimeout(check, 250);
      }).on('error', () => setTimeout(check, 250));
    }
    setTimeout(check, 600);
  });
}

async function startServer() {
  const userData = app.getPath('userData');

  // First run detection: DB file doesn't exist yet
  const dbFile = path.join(userData, 'database.sqlite');
  const isFirstRun = !fs.existsSync(dbFile);

  // Ensure uploads directory exists
  const uploadsDir = path.join(userData, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  // Generate or load persistent secrets
  function getOrCreate(file, len = 64) {
    if (!fs.existsSync(file)) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let s = '';
      for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
      fs.writeFileSync(file, s, 'utf8');
    }
    return fs.readFileSync(file, 'utf8').trim();
  }

  const jwtSecret = getOrCreate(path.join(userData, 'jwt_secret.txt'));

  // Set all env vars before importing the server (dotenv won't override existing vars)
  Object.assign(process.env, {
    NODE_ENV: 'production',
    SERVER_PORT: String(PORT),
    DB_PATH: dbFile,
    UPLOADS_PATH: uploadsDir,
    DIST_PATH: app.isPackaged
      ? path.join(process.resourcesPath, 'dist')
      : path.join(app.getAppPath(), 'dist'),
    JWT_SECRET: jwtSecret,
  });

  const serverEntry = path.join(app.getAppPath(), 'server', 'index.js');
  await import(pathToFileURL(serverEntry).href);
  await waitForServer();

  return isFirstRun;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Maja Automotores',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  let isFirstRun = false;
  try {
    isFirstRun = await startServer();
  } catch (err) {
    dialog.showErrorBox('Error al iniciar el servidor', String(err));
    app.quit();
    return;
  }

  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isFirstRun) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Primera vez — Maja Automotores',
        message: 'Se creó automáticamente tu cuenta de administrador:\n\nEmail:      admin@maja.com\nContraseña: Maja2024!\n\nCambiá la contraseña desde Usuarios después de iniciar sesión.',
        buttons: ['Entendido'],
      });
    }
    if (app.isPackaged) {
      setTimeout(() => autoUpdater.checkForUpdates(), 3000);
    }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!mainWindow) createWindow(); });
