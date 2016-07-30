const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const storage = require('electron-json-storage');
const SpotifyWebApi = require('spotify-web-api-node');
const moment = require('moment');

var CLIENT_ID = '6647f460509d4c6cb0b5d84fe1811bca';
var CLIENT_SECRET = 'b43919f0534d4ea3a746f54d71df1f99';
var REDIRECT_URI = 'http://localhost';

var spotifyApi = new SpotifyWebApi({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI
});

var SpotifyWebHelper = require('spotify-web-helper')
var spotifyPlayer = SpotifyWebHelper()

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
    $scope.selectedButtonIndex = 1

    $scope.addTrackToUpcoming = function (trackIndex) {
        manageAddTrackToUpcomingList(trackIndex);
    };

    $scope.loadPreviousPage = function () {
        playSound('collect');
        loadSavedTracks($scope.currentPage - 1)
    };

    $scope.loadNextPage = function () {
        playSound('collect');
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

            savePlayListInScope()
            loadSavedTracks($scope.currentPage)
            ipcRenderer.send("close-settings-window")
        });
    }

    // IPC COMUNICATION

    ipcRenderer.on('logout', function () {
        storage.clear(function (error) {
            if (error) throw error;
            $scope.tracksList = []
            $scope.$apply();
            ipcRenderer.send("request_oauth_token")
        });
    });

    ipcRenderer.on('add-credits', function (event, credits) {
        addCredits(credits)
    });

    ipcRenderer.on('click-arrow', function (event, direction) {
        console.log("click arrow -> " + direction);
        switch (direction) {
            case 'Right':
                moveCursorRight();
                return
            case 'Left':
                moveCursorLeft();
                return
            case 'Up':
                moveCursorUp();
                return
            case 'Down':
                moveCursorDown();
                return
        }
    });

    ipcRenderer.on('click-enter', function () {
        mamageClickEnter()
    });

    ipcRenderer.on('reload-tracks', function () {
        savePlayListInScope()


    });

    // METHODS

    function manageAddTrackToUpcomingList(trackIndex) {
        console.log('manageAddTrackToUpcomingList');
        if ($scope.credits <= 0 || $scope.tracksList.length == 0) {
            playSound('poush');
            return;
        }
        $scope.credits -= 1;

        var trackInfo = $scope.tracksList[trackIndex - 1]
        $scope.upcomingTrackList.push(trackInfo);

        playSound('collect');
    }

    function playSound(soundName) {
        var audio = new Audio(__dirname + '/sounds/' + soundName + '.wav');
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
        storage.has('spotify_token', function (error, hasKey) {
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

        var playlistData = $scope.playList;

        if (playlistData === undefined) {
            console.log("ERROR: PLAYLIST NO CONFIGURADO")
            return
        }

        console.log("user_id -> " + playlistData.playlist_user);
        console.log("playlist id -> " + playlistData.playlist_id);

        spotifyApi.getPlaylistTracks(playlistData.playlist_user, playlistData.playlist_id, {
            'offset': offset * 11, 'limit': 12
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
            storage.clear(function (error) {
                if (error) throw error;
                $scope.tracksList = []
                $scope.$apply();
                ipcRenderer.send("request_oauth_token")
            });
        }
    }

    function beginCheckingCurrentStatusTrack() {
        clearInterval(timerCheckTrack);
        timerCheckTrack = setInterval(function () {
            updateCurrentTrackInfo()

            var state = spotifyPlayer.status;

            console.log('getState -> ' + state.track.track_resource.name)
            $scope.currentRuntime = moment().startOf('day').seconds(state.playing_position).format('mm:ss');
            console.log('track position -> ' + state.playing_position)
            console.log('track total -> ' + $scope.nowPlayingTrack.track.duration)

            if (Math.ceil(state.playing_position) == $scope.nowPlayingTrack.track.duration - 1) {
                $scope.nowPlayingTrack.track.duration = 0
                playNextTrack()
            }
            $scope.$apply();
        }, 500);
    }

    function playNextTrack() {
        console.log("Play next track");
        if ($scope.upcomingTrackList.length > 0) {
            var nextTrack = $scope.upcomingTrackList[0]
            $scope.upcomingTrackList.shift()
            $scope.$apply();
            playTrack(nextTrack)
        } else {
            playRandomTrack()
        }
    }

    function playRandomTrack() {
        console.log("Play random track")
        //spotifyPlayer.player.pause()
        //spotifyPlayer.player.play()
    }

    function updateCurrentTrackInfo() {
        var status = spotifyPlayer.status;

        var trackInfo = {
            track: {
                name: status.track.track_resource.name,
                duration: status.track.length,
                album: {
                    name: status.track.album_resource.name
                },
                artists: [{
                    name: status.track.artist_resource.name
                }]
            }
        }
        $scope.nowPlayingTrack = trackInfo;
        $scope.$apply();
    }

    function playTrack(trackInfo) {
        var playlistData = $scope.playList
        if (playlistData !== undefined && playlistData.playlist_uri !== undefined) {
            console.log("PLAY TRACK -> " + trackInfo.track.uri);
            spotifyPlayer.player.play(trackInfo.track.uri, playlistData.playlist_uri);
            updateCurrentTrackInfo()
        } else {
            console.log("ERROR: PLAYLIST NOT DEFINED!");
        }
    }

    function savePlayListInScope() {
        storage.has('playlist', function (error, hasKey) {
            if (hasKey == true) {
                storage.get('playlist', function (error, playlistData) {
                    if (error) throw error;

                    $scope.playList = playlistData

                    storage.get('spotify_token', function (error, data) {
                        if (error) throw error;

                        spotifyApi.setAccessToken(data.access_token);
                        //doLoadSavedTracks($scope.currentPage)

                        doLoadTracksForCurrentPlaylist($scope.currentPage);
                    });
                });
            }
        });
    }

    function moveCursorRight() {
        switch ($scope.selectedButtonIndex) {
            case 1:
                $scope.selectedButtonIndex = 2;
                break;
            case 2:
                $scope.selectedButtonIndex = 3;
                break;
            case 3:
                $scope.selectedButtonIndex = 4;
                break;
            case 4:
                $scope.selectedButtonIndex = 5;
                break;
            case 5:
                $scope.selectedButtonIndex = 6;
                break;
            case 6:
                $scope.selectedButtonIndex = 6;
                break;
            case 7:
                $scope.selectedButtonIndex = 8;
                break;
            case 8:
                $scope.selectedButtonIndex = 9;
                break;
            case 9:
                $scope.selectedButtonIndex = 10;
                break;
            case 10:
                $scope.selectedButtonIndex = 11;
                break;
            case 11:
                $scope.selectedButtonIndex = 12;
                break;
            case 12:
                $scope.selectedButtonIndex = 12;
                break;
            case 13:
                $scope.selectedButtonIndex = 14;
                break;
            case 14:
                $scope.selectedButtonIndex = 14;
                break;
        }
        $scope.$apply();
    }

    function moveCursorLeft() {
        switch ($scope.selectedButtonIndex) {
            case 1:
                $scope.selectedButtonIndex = 1;
                break;
            case 2:
                $scope.selectedButtonIndex = 1;
                break;
            case 3:
                $scope.selectedButtonIndex = 2;
                break;
            case 4:
                $scope.selectedButtonIndex = 3;
                break;
            case 5:
                $scope.selectedButtonIndex = 4;
                break;
            case 6:
                $scope.selectedButtonIndex = 5;
                break;
            case 7:
                $scope.selectedButtonIndex = 7;
                break;
            case 8:
                $scope.selectedButtonIndex = 7;
                break;
            case 9:
                $scope.selectedButtonIndex = 8;
                break;
            case 10:
                $scope.selectedButtonIndex = 9;
                break;
            case 11:
                $scope.selectedButtonIndex = 10;
                break;
            case 12:
                $scope.selectedButtonIndex = 11;
                break;
            case 13:
                $scope.selectedButtonIndex = 13;
                break;
            case 14:
                $scope.selectedButtonIndex = 13;
                break;
        }
        $scope.$apply();
    }

    function moveCursorUp() {
        switch ($scope.selectedButtonIndex) {
            case 1:
                $scope.selectedButtonIndex = 1;
                break;
            case 2:
                $scope.selectedButtonIndex = 2;
                break;
            case 3:
                $scope.selectedButtonIndex = 3;
                break;
            case 4:
                $scope.selectedButtonIndex = 4;
                break;
            case 5:
                $scope.selectedButtonIndex = 5;
                break;
            case 6:
                $scope.selectedButtonIndex = 6;
                break;
            case 7:
                $scope.selectedButtonIndex = 1;
                break;
            case 8:
                $scope.selectedButtonIndex = 2;
                break;
            case 9:
                $scope.selectedButtonIndex = 3;
                break;
            case 10:
                $scope.selectedButtonIndex = 4;
                break;
            case 11:
                $scope.selectedButtonIndex = 5;
                break;
            case 12:
                $scope.selectedButtonIndex = 6;
                break;
            case 13:
                $scope.selectedButtonIndex = 8;
                break;
            case 14:
                $scope.selectedButtonIndex = 11;
                break;
        }
        $scope.$apply();
    }

    function moveCursorDown() {
        switch ($scope.selectedButtonIndex) {
            case 1:
                $scope.selectedButtonIndex = 7;
                break;
            case 2:
                $scope.selectedButtonIndex = 8;
                break;
            case 3:
                $scope.selectedButtonIndex = 9;
                break;
            case 4:
                $scope.selectedButtonIndex = 10;
                break;
            case 5:
                $scope.selectedButtonIndex = 11;
                break;
            case 6:
                $scope.selectedButtonIndex = 12;
                break;
            case 7:
                $scope.selectedButtonIndex = 13;
                break;
            case 8:
                $scope.selectedButtonIndex = 13;
                break;
            case 9:
                $scope.selectedButtonIndex = 13;
                break;
            case 10:
                $scope.selectedButtonIndex = 14;
                break;
            case 11:
                $scope.selectedButtonIndex = 14;
                break;
            case 12:
                $scope.selectedButtonIndex = 14;
                break;
            case 13:
                $scope.selectedButtonIndex = 13;
                break;
            case 14:
                $scope.selectedButtonIndex = 14;
                break;
        }
        $scope.$apply();
    }

    function mamageClickEnter() {
        console.log("click enter");
        switch ($scope.selectedButtonIndex) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
                manageAddTrackToUpcomingList($scope.selectedButtonIndex);
                break;
            case 13:
                loadSavedTracks($scope.currentPage - 1);
                break;
            case 14:
                loadSavedTracks($scope.currentPage + 1);
                break;
        }
    }

    // START HERE

    spotifyPlayer.player.on('ready', function () {
        savePlayListInScope()
        loadSavedTracks($scope.currentPage)
        spotifyPlayer.player.play()
    });
});