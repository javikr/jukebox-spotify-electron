'use strict';

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const globalShortcut = electron.globalShortcut;
const electronOauth2 = require('electron-oauth2');
const storage = require('electron-json-storage');
const ipcMain = electron.ipcMain;
const Menu = electron.Menu;
const SpotifyWebApi = require('spotify-web-api-node');

var CLIENT_ID = '6647f460509d4c6cb0b5d84fe1811bca';
var CLIENT_SECRET = 'b43919f0534d4ea3a746f54d71df1f99';
var REDIRECT_URI = 'http://localhost';

var spotifyApi = new SpotifyWebApi({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI
});

var config = {
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  authorizationUrl: 'https://accounts.spotify.com/authorize',
  tokenUrl: 'https://accounts.spotify.com/api/token',
  useBasicAuthorizationHeader: true,
  redirectUri: REDIRECT_URI
};

var mainWindow;
var mainMenu;

function launchApp() {
  checkAccessToken(function () {
    loadUserPlaylists()
  })
}

function createAndShowMainWindow() {
  if (mainWindow !== undefined) { return }

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    resizable: true,
    title: "Spotify Jukebox",
    show: false,
    maximizable: true,
    fullscreen: true
  });

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

  mainWindow.once('ready-to-show', function () {
    mainWindow.show()
    setGlobalShortcuts()
  })
}

// initialization and is ready to create browser windows.
app.on('ready', launchApp);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    console.log("all windows closed")
    //app.quit();
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createAndShowMainWindow();
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

function createMenuWithPlaylists(playlists) {

  var template = [{
    label: "Application",
    submenu: [
      { label: "About Application", selector: "orderFrontStandardAboutPanel:" },
      { type: "separator" },
      { label: 'Show debug', click() { mainWindow.webContents.openDevTools(); } },
      { label: "Quit", accelerator: "CmdOrCtrl+Q", click: function() { app.quit(); }}
    ]}, {
    label: "Spotify",
    submenu: [
      { label: 'Logout', click() { mainWindow.webContents.send('logout'); } },
      { label: 'Playlists', submenu: [] }
    ]}
  ];

  obtainCurrentPlaylist(function (selectedPlaylistId) {
    console.log("selectedPlaylistId -> " + selectedPlaylistId);
    var playlistsSubmenu = template[1].submenu[1].submenu;
    playlists.forEach(function(playlist) {
      playlistsSubmenu.push({ label: playlist.name,type: 'radio', checked: (selectedPlaylistId == playlist.id), click() { didSelectPlaylist(playlist) }})
    });

    mainMenu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(mainMenu)
  })
}

function loadUserPlaylists() {
  storage.has('user_info', function (error, hasKey) {
    if (error) throw error;
    if (hasKey == false) {
      reloadMeInfo()
      return
    }

    storage.get('user_info', function (error, userData) {
      if (error) throw error;

      console.log("user_id -> " + userData.user_id);

      spotifyApi.getUserPlaylists(userData.user_id)
          .then(function(data) {
            console.log('Retrieved playlists');
            createMenuWithPlaylists(data.body.items)
            createAndShowMainWindow()
            checkAnyPlaylistSelected(data.body.items[0])
          },function(err) {
            console.log('Something went wrong!', err);
            if (err.statusCode == 401 || err.statusCode == 403) {
              loginToSpotify()
            }
          });
      });
  });
}

function checkAnyPlaylistSelected(firstPlaylist) {
  storage.has('playlist', function (error, hasKey) {
    if (hasKey == false) {
      didSelectPlaylist(firstPlaylist)
    }
  });
}

function obtainCurrentPlaylist(completion) {
  storage.has('playlist', function (error, hasKey) {
    if (hasKey == true) {
      storage.get('playlist', function (error, playlistData) {
        if (error) throw error;
        completion(playlistData.playlist_id)
      });
    } else {
      completion(undefined)
    }
  });
}

function reloadMeInfo(completion) {
  spotifyApi.getMe()
      .then(function(data) {
        console.log('Some information about the authenticated user', data.body);
        storage.set('user_info', { user_id: data.body.id, user_name: data.body.display_name }, function (error) {
          if (error) throw error;
          completion()
        });
      }, function(err) {
        console.log('Something went wrong!', err);
        if (err.statusCode == 401 || err.statusCode == 403) {
          loginToSpotify()
        }
      });
}

function didSelectPlaylist(playlist) {
  console.log('savePlayListId -> ' + playlist.id)
  console.log('savePlayListuri -> ' + playlist.uri)
  console.log('playlistUser -> ' + playlist.owner.id)

  storage.set('playlist', { playlist_id: playlist.id, playlist_uri: playlist.uri, playlist_user: playlist.owner.id }, function (error) {
    if (error) throw error;
    mainWindow.webContents.send('reload-tracks');
  });
}

function checkAccessToken(completion) {
  storage.has('spotify_token', function (error, hasKey) {
    if (error) throw error;

    if (hasKey == true) {
      storage.get('spotify_token', function (error, data) {
        if (error) throw error;
        spotifyApi.setAccessToken(data.access_token);
        completion()
      });
    } else {
      loginToSpotify()
    }
  })
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
          storage.remove('spotify_token', function (error, data) {
            loginToSpotify()
          });
          return
        }

        console.log("Try refresh token with : " + data.refresh_token)
        myApiOauth.refreshToken(data.refresh_token).then(newToken => {
          console.log("newToken access_token -> " + newToken.access_token);
        storage.set('spotify_token', { access_token: newToken.access_token, refresh_token: data.refresh_token }, function (error) {
          if (error) throw error;
          spotifyApi.setAccessToken(newToken.access_token);
          reloadMeInfo(function () {
            loadUserPlaylists()
            if (mainWindow !== undefined) {
              mainWindow.webContents.send('reload-tracks');
            }
          })
        });
      })
      })
    } else {
      myApiOauth.getAccessToken(options).then(token => {
        console.log("token access_token -> " + token.access_token);
      console.log("token refresh_token -> " + token.refresh_token);

      storage.set('spotify_token', { access_token: token.access_token, refresh_token: token.refresh_token }, function (error) {
        if (error) throw error;
        spotifyApi.setAccessToken(token.access_token);
        reloadMeInfo(function () {
          loadUserPlaylists()
          if (mainWindow !== undefined) {
            mainWindow.webContents.send('reload-tracks');
          }
        })
      });
    })
    }
  })
}

// IPC

ipcMain.on('request_oauth_token', function () {
  console.log("request_oauth_token");
  loginToSpotify()
});

