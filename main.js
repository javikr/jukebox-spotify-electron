'use strict';

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const globalShortcut = electron.globalShortcut;
const electronOauth2 = require('electron-oauth2');
const storage = require('electron-json-storage');
const ipcMain = electron.ipcMain;
const Menu = electron.Menu;

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

var prefsWindow;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow;

function launchApp() {
  createMainWindow()
  createMenu()
  createSettingsWindow()
  setGlobalShortcuts();
}

function createMainWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    resizable: true,
    title: "Jukebox",
    show: false,
    maximizable: true
  });

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/app/index.html');

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

function createSettingsWindow() {
  prefsWindow = new BrowserWindow({
    width: 600,
    height: 600,
    resizable: false,
    title: "Settings",
    show: false,
    parent: mainWindow
  });
}

function createMenu() {
  var template = [{
    label: "Application",
    submenu: [
      { label: "About Application", selector: "orderFrontStandardAboutPanel:" },
      { type: "separator" },
      { label: 'Settings', click() { didTapSettings() } },
      { label: 'Show debug', click() { mainWindow.webContents.openDevTools(); } },
      { label: "Quit", accelerator: "Command+Q", click: function() { app.quit(); }}
    ]}, {
    label: "Edit",
    submenu: [
      { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
      { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
      { type: "separator" },
      { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
      { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
      { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" }
      ]}, {
    label: "Spotify",
    submenu: [
      { label: 'Logout', click() { mainWindow.webContents.send('logout'); } }
    ]}
  ];


  const mainMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(mainMenu)
  //app.dock.setMenu(dockMenu);
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

  storage.has('spotify_token', function (error, hasKey) {
    if (error) throw error;

    if (hasKey == true) {
      storage.get('spotify_token', function (error, data) {
        if (error) throw error;
        if (data.refresh_token === undefined) {
          storage.clear(function(error) {
            if (error) throw error;
            loginToSpotify()
            return
          });
        }

        console.log("Try refresh token with : " + data.refresh_token)
        myApiOauth.refreshToken(data.refresh_token).then(newToken => {
          //use your new token
          console.log("newToken access_token -> " + newToken.access_token);
        console.log("newToken refresh_token -> " + newToken.refresh_token);
        storage.set('spotify_token', {access_token: newToken.access_token, refresh_token: newToken.refresh_token}, function (error) {
          if (error) throw error;
          mainWindow.webContents.send('reload-tracks');
        });
      })
      })
    } else {
      myApiOauth.getAccessToken(options).then(token => {
        // use your token.access_token
        console.log("token access_token -> " + token.access_token);
      console.log("token refresh_token -> " + token.refresh_token);

      storage.set('spotify_token', {access_token: token.access_token, refresh_token: token.refresh_token}, function (error) {
        if (error) throw error;
        mainWindow.webContents.send('reload-tracks');
      });
    })
    }
})
}

// initialization and is ready to create browser windows.
app.on('ready', launchApp);

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

  globalShortcut.register('Left', function () {
    mainWindow.webContents.send('click-arrow', "Left");
  });

  globalShortcut.register('Right', function () {
    mainWindow.webContents.send('click-arrow', "Right");
  });

  globalShortcut.register('Up', function () {
    mainWindow.webContents.send('click-arrow', "Up");
  });

  globalShortcut.register('Down', function () {
    mainWindow.webContents.send('click-arrow', "Down");
  });

  globalShortcut.register('1', function () {
    mainWindow.webContents.send('click-enter');
  });
}

function didTapSettings() {
  prefsWindow.loadURL('file://' + __dirname + '/app/settings.html')
  prefsWindow.once('ready-to-show', () => {
    prefsWindow.show()
  })
}

ipcMain.on('request_oauth_token', function () {
  console.log("request_oauth_token");
  loginToSpotify()
});

ipcMain.on("playlist-saved", function () {
  console.log("playlist-saved");
  mainWindow.webContents.send('reload-tracks');
})

ipcMain.on("close-settings-window", function () {
  console.log("close-settings-window");
  prefsWindow.hide()
})
