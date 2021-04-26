const {app, BrowserWindow} = require('electron');
const path = require('path');
const iapProxy = require('./iap-proxy');
const pjson = require('../package.json');

if (require('electron-squirrel-startup')) return;
if (process.platform === 'linux') {
    app.disableHardwareAcceleration();
}

let windowRef;
let isClosed = false;

require('@electron/remote/main').initialize();
require('electron-store').initRenderer();

console.log = function (msg) {
    if (windowRef && !windowRef.isDestroyed()) {
        windowRef.webContents.send('log-data', msg);
    }
}

process.on('uncaughtException', function (error) {
    console.log(`💡 ${error}`);
});

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
    console.log(`✨ v.${ pjson.version }`);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    isClosed = true;
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on('activate', () => {
    if (iapProxy.server !== null && isClosed === true) {
        setTimeout(() => {
            isClosed = false;
            console.log('💡 Server is running on port : ' + iapProxy.port);
        }, 1000);
    }
});
