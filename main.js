const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    backgroundColor: '#ffffff', // Fuerza un color de fondo para evitar pantallas blancas
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      spellcheck: false // A veces el corrector ortográfico bloquea el input en el primer carga
    }
  });

  win.loadFile('login.html');

  // --- SOLUCIÓN AL BLOQUEO ---
  // Esta función fuerza a la ventana a "despertar" visualmente apenas carga
  win.webContents.on('did-finish-load', () => {
    win.focus(); // Obliga a la ventana a tomar el foco del sistema
  });

  // Si se detecta que la ventana pierde interactividad, la refrescamos internamente
  win.on('blur', () => {
    win.webContents.invalidate(); 
  });
}

// Deshabilitar la aceleración de hardware si el problema persiste (opcional)
// app.disableHardwareAcceleration();

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on('imprimir-silencioso', (event, htmlContent) => {
  let printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
  printWin.webContents.on('did-finish-load', () => {
    printWin.webContents.print({ silent: true, printBackground: true }, (success, errorType) => {
      if (!success) console.error("Error de impresión:", errorType);
      printWin.close();
    });
  });
});