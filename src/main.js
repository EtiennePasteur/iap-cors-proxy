const {app, BrowserWindow} = require('electron');
const path = require('path');

if (require('electron-squirrel-startup')) return;
if (process.platform === 'linux') {
    app.disableHardwareAcceleration();
}

let windowRef;

require('@electron/remote/main').initialize();
require('electron-store').initRenderer();

console.log = function (msg) {
    if (windowRef) {
        windowRef.webContents.send('log-data', msg);
    }
}

process.on('uncaughtException', function (error) {
    console.log(`💡 ${error}`);
})

function createWindow() {
    windowRef = new BrowserWindow({
        width: 350,
        height: 750,
        resizable: false,
        icon: path.join(__dirname, '../assets/icons/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        }
    });

    windowRef.loadFile('./src/index.html');

}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
})
