const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const SpotifyWebApi = require('spotify-web-api-node');
const storage = require('electron-json-storage');
const spotifyPlayer = require('spotify-node-applescript');
const moment = require('moment');

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
    $scope.currentRuntime = 0

    $scope.addTrackToUpcoming = function (trackIndex) {
        if ($scope.credits <= 0) {
            return;
        }
        $scope.credits -= 1;

        var trackInfo = $scope.tracksList[trackIndex-1]
        $scope.upcomingTrackList.push(trackInfo);
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

    $scope.savePlayList = function () {
        console.log("savePlayListId! -> " + $scope.playlistid)
        console.log("savePlayListuri! -> " + $scope.playlisturi)

        storage.set('playlist', {playlist_id: $scope.playlistid, playlist_uri: $scope.playlisturi}, function (error) {
            if (error) throw error;

            loadSavedTracks($scope.currentPage)
        });
    }

    // IPC COMUNICATION

    ipcRenderer.on('logout', function () {
        storage.clear(function(error) {
            if (error) throw error;
            $scope.tracksList = []
            $scope.$apply();
            ipcRenderer.send("request_oauth_token")
        });
    });

    ipcRenderer.on('add-credits', function (credits) {
        $scope.credits += 1;
        $scope.$apply();
        console.log("add-credits -> " + $scope.credits);
    });

    ipcRenderer.on('reload-tracks', function () {
        spotifyApi.getMe()
            .then(function(data) {
                console.log('Some information about the authenticated user', data.body);
                storage.set('user_info', {user_id: data.body.id, user_name: data.body.display_name}, function (error) {
                    if (error) throw error;
                    storage.get('spotify_token', function (error, data) {
                        if (error) throw error;

                        spotifyApi.setAccessToken(data.access_token);
                        //doLoadSavedTracks($scope.currentPage)

                        doLoadTracksForCurrentPlaylist($scope.currentPage);
                    });
                });
            }, function(err) {
                console.log('Something went wrong!', err);
            });

    });

    // INITIAL LOAD SAVED TRACKS

    loadSavedTracks($scope.currentPage)

    // METHODS

    function loadSavedTracks(offset) {
        storage.has('spotify_token', function(error, hasKey) {
            if (error) throw error;
            if (hasKey == false) {
                ipcRenderer.send("request_oauth_token")
                return
            }

            storage.get('spotify_token', function (error, data) {
                if (error) throw error;

                console.log("access_token_data -> " + data.access_token);
                spotifyApi.setAccessToken(data.access_token);
                //doLoadSavedTracks(offset)

                // 6dHXEp5dznJXBL6JqB8Opm
                doLoadTracksForCurrentPlaylist(offset);
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
                console.log('Tracks loaded! -> ' + data.body);
                didLoadedTracks(data.body.items);
                $scope.currentPage = offset
                $scope.$apply();
                beginCheckingCurrentStatusTrack();
            }, function (err) {
                didGetErrorLoadingTracks(err);
            });
    }

    function doLoadTracksForCurrentPlaylist(offset) {

        storage.get('playlist', function (error, playlistData) {
            if (error) throw error;

            if (playlistData.playlist_id === undefined) {
                console.log("ERROR: PLAYLIST NO CONFIGURADO")
                return
            }

            storage.get('user_info', function (error, userData) {
                if (error) throw error;

                if (userData.user_id === undefined) {
                    reloadMeInfo()
                    return;
                }

                console.log("user_id -> " + userData.user_id);
                console.log("playlist id -> " + playlistData.playlist_id);

                spotifyApi.getPlaylistTracks(userData.user_id, playlistData.playlist_id, {
                    'offset' : offset * 11, 'limit' : 12
                })
                    .then(function (data) {
                        console.log('Tracks loaded! -> ' + data.body);
                        didLoadedTracks(data.body.items);
                        $scope.currentPage = offset
                        $scope.$apply();
                        beginCheckingCurrentStatusTrack();
                    }, function (err) {
                        didGetErrorLoadingTracks(err);
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

                    loadSavedTracks($scope.currentPage)
                });
            }, function(err) {
                console.log('Something went wrong!', err);
            });
    }

    function didLoadedTracks(tracks) {
        console.log('Tracks loaded! -> ' + tracks);
        $scope.tracksList = tracks;
        $scope.$apply();
        beginCheckingCurrentStatusTrack();
    }

    function didGetErrorLoadingTracks(err) {
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
    }

    function beginCheckingCurrentStatusTrack() {
        setInterval(function(){
            updateCurrentTrackInfo()
            spotifyPlayer.getState(function(err, state){
                console.log('getState -> ' + state.state)
                $scope.currentRuntime = moment().startOf('day').seconds(state.position).format('mm:ss');
                $scope.$apply();
                if (state.state == 'paused') {
                    playNextTrack()
                }
            });
        }, 1000);
    }

    function playNextTrack() {
        console.log("Play next track");
        if ($scope.upcomingTrackList.length > 0) {
            spotifyPlayer.setShuffling(false, function(){
                console.log("Shuffling OFF!")

                var nextTrack = $scope.upcomingTrackList[0]
                $scope.upcomingTrackList.shift()
                $scope.$apply();
                playTrack(nextTrack)
            });
        } else {
            playRandomTrack()
        }
    }

    function playRandomTrack() {
        console.log("Play random track")
        spotifyPlayer.isShuffling(function(err, shuffling){
            if (shuffling == false) {
                spotifyPlayer.setShuffling(true, function(){
                    console.log("Shuffling SET ON!")
                    spotifyPlayer.next(function(){
                    });
                });
            } else {
                console.log("Shuffling IS ON")
                spotifyPlayer.play(function(){}
                );
            }
        });

    }

    function updateCurrentTrackInfo() {
        spotifyPlayer.getTrack(function(err, track){
            var trackInfo = {
                track: {
                    name: track.name,
                    album: {
                        name: track.album
                    },
                    artists: [{
                        name: track.artist
                    }]
                }
            }
            $scope.nowPlayingTrack = trackInfo;
            $scope.$apply();
        });
    }

    function playTrack(trackInfo) {

        storage.has('playlist', function(error, hasKey) {
            if (hasKey == true) {
                storage.get('playlist', function (error, playlistData) {
                    if (error) throw error;

                    if (playlistData.playlist_uri !== undefined) {
                        spotifyPlayer.playTrackInContext(trackInfo.track.uri, playlistData.playlist_uri, function(){
                            updateCurrentTrackInfo()
                        });
                        return;
                    }
                });
            }
        });

        spotifyPlayer.playTrack(trackInfo.track.uri, function(){
            updateCurrentTrackInfo()
        });
    }
});




