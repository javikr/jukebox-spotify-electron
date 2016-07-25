'use strict';

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const globalShortcut = electron.globalShortcut;
const electronOauth2 = require('electron-oauth2');
const storage = require('electron-json-storage');
const ipcMain = electron.ipcMain;

var CLIENT_ID = '6647f460509d4c6cb0b5d84fe1811bca';
var CLIENT_SECRET = 'b43919f0534d4ea3a746f54d71df1f99';
var REDIRECT_URI = 'http://localhost';

var config = {
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  authorizationUrl: 'https://accounts.spotify.com/authorize',
  tokenUrl: 'https://accounts.spotify.com/api/token',
  useBasicAuthorizationHeader: true,
  redirectUri: REDIRECT_URI
};


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    resizable: false,
    title: "Jukebox"
  });

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/app/index.html');

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  setGlobalShortcuts();
}

function loginToSpotify() {
  const options = {
    scope: 'user-read-private playlist-read-private playlist-read-collaborative user-library-read'
  };

  const windowParams = {
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false
    }
  };

  const myApiOauth = electronOauth2(config, windowParams);

  storage.has('spotify_token', function(error, hasKey) {
    if (error) throw error;

    if (hasKey) {
      storage.get('spotify_token', function(error, data) {
        if (error) throw error;

        myApiOauth.refreshToken(data.token.refresh_token).then(newToken => {
          //use your new token
          console.log("newToken -> " + newToken.access_token);
        storage.set('spotify_token', { token: newToken }, function(error) {
          if (error) throw error;
          mainWindow.webContents.send('reload-tracks');
        });
      })
      })
    } else {
      myApiOauth.getAccessToken(options).then(token => {
        // use your token.access_token
        console.log("access_token -> " + token.access_token);
      console.log("refresh_token -> " + token.refresh_token);

      storage.set('spotify_token', { token: token }, function(error) {
        if (error) throw error;
        mainWindow.webContents.send('reload-tracks');
      });
    })
  }
})
}

// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});


function setGlobalShortcuts() {
  globalShortcut.unregisterAll();

  globalShortcut.register('5', function () {
    mainWindow.webContents.send('add-credits', 1);
  });
}

ipcMain.on('request_oauth_token', function () {
  console.log("request_oauth_token");
  loginToSpotify()
});