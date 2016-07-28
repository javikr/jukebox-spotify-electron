const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const storage = require('electron-json-storage');

var app = angular.module('JukeboxApp', []);

app.controller('settingsController', function ($scope) {

    $scope.savePlayList = function () {
        console.log('savePlayListId -> ' + $scope.playlistid)
        console.log('savePlayListuri -> ' + $scope.playlisturi)

        storage.set('playlist', {playlist_id: $scope.playlistid, playlist_uri: $scope.playlisturi}, function (error) {
            if (error) throw error;

            ipcRenderer.send("playlist-saved")
            ipcRenderer.send("close-settings-window")
        });
    }

});
