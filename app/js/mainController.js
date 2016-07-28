const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const storage = require('electron-json-storage');
const SpotifyWebApi = require('spotify-web-api-node');
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

var app = angular.module('JukeboxApp', []);

app.controller('mainController', function ($scope) {

    var timerCheckTrack = 0;

    $scope.tracksList = []
    $scope.upcomingTrackList = [];
    $scope.credits = 0;
    $scope.nameFilter = null;
    $scope.nowPlayingTrack = null;
    $scope.currentPage = 0
    $scope.currentRuntime = 0

    $scope.addTrackToUpcoming = function (trackIndex) {
        if ($scope.credits <= 0 || $scope.tracksList.length == 0) {
            playSound('poush');
            return;
        }
        $scope.credits -= 1;

        var trackInfo = $scope.tracksList[trackIndex-1]
        $scope.upcomingTrackList.push(trackInfo);

        playSound('collect');
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
        console.log('savePlayListId -> ' + $scope.playlistid)
        console.log('savePlayListuri -> ' + $scope.playlisturi)

        storage.set('playlist', {playlist_id: $scope.playlistid, playlist_uri: $scope.playlisturi}, function (error) {
            if (error) throw error;

            loadSavedTracks($scope.currentPage)
            ipcRenderer.send("close-settings-window")
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
        addCredits(1)
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

    function playSound(soundName) {
        var audio = new Audio(__dirname + '/sounds/'+soundName+'.wav');
        audio.currentTime = 0;
        audio.play();
    }

    function addCredits(credits) {
        $scope.credits += credits;
        $scope.$apply();
        console.log("add-credits -> " + $scope.credits);

        playSound('bonus');
    }

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
                playSound('bonus');
                didLoadedTracks(data.body.items);
                $scope.currentPage = offset
                $scope.$apply();
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
                        playSound('bonus');
                        didLoadedTracks(data.body.items);
                        $scope.currentPage = offset
                        $scope.$apply();
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
        clearInterval(timerCheckTrack);
        timerCheckTrack = setInterval(function(){
            updateCurrentTrackInfo()
            spotifyPlayer.getState(function(err, state){
                //console.log('getState -> ' + state.state)
                $scope.currentRuntime = moment().startOf('day').seconds(state.position).format('mm:ss');
                $scope.$apply();
                console.log('track position -> '+state.position)
                console.log('track total -> '+ Math.floor($scope.nowPlayingTrack.track.duration/1000) - 1)
                if (state.state == 'paused' || state.position == Math.floor($scope.nowPlayingTrack.track.duration/1000) - 1) {
                    playNextTrack()
                }
            });
        }, 500);
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
                    duration: track.duration,
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




