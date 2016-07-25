const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const SpotifyWebApi = require('spotify-web-api-node');
const storage = require('electron-json-storage');
const spotifyPlayer = require('spotify-node-applescript');

var CLIENT_ID = '6647f460509d4c6cb0b5d84fe1811bca';
var CLIENT_SECRET = 'b43919f0534d4ea3a746f54d71df1f99';
var REDIRECT_URI = 'http://localhost';


// credentials are optional
var spotifyApi = new SpotifyWebApi({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI
});

angular.module('JukeboxApp.controllers', []).
controller('mainController', function ($scope) {

    $scope.tracksList = []
    $scope.upcomingTrackList = [];
    $scope.credits = 0;
    $scope.nameFilter = null;
    $scope.nowPlayingTrack = null;
    $scope.currentPage = 0

    $scope.addTrackToUpcoming = function (trackIndex) {
        if ($scope.credits <= 0) {
            return;
        }
        $scope.credits -= 1;

        var trackInfo = $scope.tracksList[trackIndex-1]
        $scope.upcomingTrackList.push(trackInfo);

        if ($scope.nowPlayingTrack == null) {
            $scope.nowPlayingTrack = trackInfo;
        }

        console.log("track uri -> " + trackInfo.track.uri)
        playTrack(trackInfo.track.uri)
    };

    $scope.loadPreviousPage = function () {
        loadSavedTracks($scope.currentPage - 1)
    };

    $scope.loadNextPage = function () {
        loadSavedTracks($scope.currentPage + 1)
    };

    $scope.comingUp = function () {
        return $scope.upcomingTrackList.length;
    };

    $scope.logoutSpotify = function() {
        storage.clear(function(error) {
            if (error) throw error;
            $scope.tracksList = []
            $scope.$apply();
            ipcRenderer.send("request_oauth_token")
        });
    }

    // IPC COMUNICATION

    ipcRenderer.on('add-credits', function (credits) {
        $scope.credits += 1;
        $scope.$apply();
        console.log("add-credits -> " + $scope.credits);
    });

    ipcRenderer.on('reload-tracks', function () {
        storage.get('spotify_token', function (error, data) {
            if (error) throw error;
            
            spotifyApi.setAccessToken(data.access_token);
            doLoadSavedTracks($scope.currentPage)
        });
    });

    // INITIAL LOAD SAVED TRACKS

    loadSavedTracks($scope.currentPage)

    // METHODS

    function loadSavedTracks(offset) {
        storage.has('spotify_token', function(error, hasKey) {
            if (error) throw error;
            if (!hasKey) {
                ipcRenderer.send("request_oauth_token")
                return
            }

            storage.get('spotify_token', function (error, data) {
                if (error) throw error;

                console.log("access_token_data -> " + data.access_token);
                spotifyApi.setAccessToken(data.access_token);
                doLoadSavedTracks(offset)
            });
        });
    }

    function doLoadSavedTracks(offset) {
        offset = (offset < 0) ? 0 : offset;
        spotifyApi.getMySavedTracks({
            limit: 12,
            offset: offset * 11
        })
            .then(function (data) {
                console.log('Tracks loaded!');
                $scope.currentPage = offset
                $scope.tracksList = data.body.items;
                $scope.$apply();
            }, function (err) {
                console.log('Something went wrong!', err);
                if (err.statusCode == 401) {
                    console.log("error 401");
                    ipcRenderer.send("request_oauth_token")
                } else if (err.statusCode == 403) {
                    console.log("error 403");
                    storage.clear(function(error) {
                        if (error) throw error;
                        $scope.tracksList = []
                        $scope.$apply();
                        ipcRenderer.send("request_oauth_token")
                    });
                }
            });
    }


    function playTrack(uri) {
        spotifyPlayer.playTrack(uri, function(){
            // track is playing
        });
    }
});




