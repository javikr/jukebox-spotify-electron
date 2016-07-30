const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const storage = require('electron-json-storage');
const SpotifyWebApi = require('spotify-web-api-node');

var CLIENT_ID = '6647f460509d4c6cb0b5d84fe1811bca';
var CLIENT_SECRET = 'b43919f0534d4ea3a746f54d71df1f99';
var REDIRECT_URI = 'http://localhost';

var spotifyApi = new SpotifyWebApi({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI
});

var app = angular.module('JukeboxApp', []);

app.controller('settingsController', function ($scope) {

    $scope.playlists = [];

    $scope.savePlayList = function (playlistUri, playlistId, playlistUser) {
        console.log('savePlayListId -> ' + playlistId)
        console.log('savePlayListuri -> ' + playlistUri)
        console.log('playlistUser -> ' + playlistUser)

        storage.set('playlist', {playlist_id: playlistId, playlist_uri: playlistUri, playlist_user: playlistUser}, function (error) {
            if (error) throw error;

            ipcRenderer.send("playlist-saved")
            ipcRenderer.send("close-settings-window")
        });
    }

    function loadPlaylists() {
        storage.has('spotify_token', function (error, hasKey) {
            if (error) throw error;
            if (hasKey == false) {
                ipcRenderer.send("request_oauth_token")
                return
            }
            storage.get('spotify_token', function (error, data) {
                if (error) throw error;

                spotifyApi.setAccessToken(data.access_token);
                console.log("update access token -> " + data.access_token)
                doLoadUserPlayLists();
            });
        });
    }

    function doLoadUserPlayLists() {
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
                        console.log('Retrieved playlists', data.body);
                        $scope.playlists = data.body.items;
                        $scope.$apply();
                    },function(err) {
                        console.log('Something went wrong!', err);
                        if (err.statusCode == 401) {
                            ipcRenderer.send("request_oauth_token")
                        }
                    });
            });
        });
    }

    function reloadMeInfo() {
        spotifyApi.getMe()
            .then(function(data) {
                console.log('Some information about the authenticated user', data.body);
                storage.set('user_info', {user_id: data.body.id, user_name: data.body.display_name}, function (error) {
                    if (error) throw error;

                    doLoadUserPlayLists()
                });
            }, function(err) {
                console.log('Something went wrong!', err);
                if (err.statusCode == 401) {
                    ipcRenderer.send("request_oauth_token")
                }
            });
    }

    // LOAD PLAYLISTS

    loadPlaylists()

});
