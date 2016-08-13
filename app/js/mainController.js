const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const storage = require('electron-json-storage');
const SpotifyWebApi = require('spotify-web-api-node');
const moment = require('moment');

var CLIENT_ID = '6647f460509d4c6cb0b5d84fe1811bca'; // put yours!
var CLIENT_SECRET = 'b43919f0534d4ea3a746f54d71df1f99'; // put yours!
var REDIRECT_URI = 'http://localhost';

var spotifyApi = new SpotifyWebApi({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI
});

var SpotifyWebHelper = require('spotify-web-helper');
var spotifyPlayer = SpotifyWebHelper();

var app = angular.module('JukeboxApp', []);

app.controller('mainController', function ($scope) {

    var timerCheckTrack = 0;
    var tracksByPage = 12;
    var loadingTrack = false;
    var loadingTrackUri = undefined;

    $scope.tracksList = [];
    $scope.upcomingTrackList = [];
    $scope.credits = 0;
    $scope.nameFilter = null;
    $scope.nowPlayingTrack = null;
    $scope.totalPages = 0;
    $scope.currentPage = 0;
    $scope.currentRuntime = 0;
    $scope.selectedButtonIndex = 1;
    
    $scope.clickAddCredits = function () {
        addCredits(1)
    };

    $scope.addTrackToUpcoming = function (trackIndex) {
        playSound('button-20');
        manageAddTrackToUpcomingList(trackIndex);
    };

    $scope.loadPreviousPage = function () {
        playSound('button-17');
        loadTracks($scope.currentPage - 1)
    };

    $scope.loadNextPage = function () {
        playSound('button-17');
        loadTracks($scope.currentPage + 1)
    };

    $scope.comingUp = function () {
        return $scope.upcomingTrackList.length;
    };

    // IPC COMUNICATION

    ipcRenderer.on('logout', function () {
        storage.clear(function (error) {
            if (error) throw error;
            $scope.tracksList = [];
            $scope.$apply();
            ipcRenderer.send("request_oauth_token")
        });
    });

    ipcRenderer.on('add-credits', function (event, credits) {
        addCredits(credits)
    });

    ipcRenderer.on('click-arrow', function (event, direction) {
        console.log("click arrow -> " + direction);
        playSound('button-16');
        switch (direction) {
            case 'Right':
                moveCursorRight();
                return;
            case 'Left':
                moveCursorLeft();
                return;
            case 'Up':
                moveCursorUp();
                return;
            case 'Down':
                moveCursorDown();
                return;
        }
    });

    ipcRenderer.on('click-enter', function () {
        manageClickEnter()
    });

    ipcRenderer.on('reload-tracks', function () {
        if ($scope.loadingHidden == false) { return }
        reloadTracks()
    });

    ipcRenderer.on('changed-playlist', function () {
        $scope.upcomingTrackList = [];
        reloadTracks()
    });

    ipcRenderer.on('skip-track', function () {
        playNextTrack()
    });

    // METHODS

    function reloadTracks() {
        $scope.tracksList = [];
        $scope.currentPage = 0;
        savePlayListInScope(function () {
            loadTracks($scope.currentPage)
        })
    }

    function manageAddTrackToUpcomingList(trackIndex) {
        if ($scope.loadingHidden == false) { return }
        if ($scope.credits <= 0 || $scope.tracksList.length == 0) {
            playSound('poush');
            return;
        }
        $scope.credits -= 1;

        var trackInfo = $scope.tracksList[trackIndex - 1];
        $scope.upcomingTrackList.push(trackInfo);
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
    
    function loadTracks(offset) {
        if ($scope.loadingHidden == false || offset < 0) { return }
        checkAccessToken(function () {
            doLoadTracksForCurrentPlaylist(offset)
        })
    }

    function doLoadTracksForCurrentPlaylist(offset) {
        console.log("Load tracks...");
        var playlistData = $scope.playList;

        if (playlistData === undefined) {
            console.log("ERROR: PLAYLIST NOT SELECTED! Please select it from the Spotify menu")
            return
        }

        showLoading()

        console.log("user id -> " + playlistData.playlist_user);
        console.log("playlist id -> " + playlistData.playlist_id);

        spotifyApi.getPlaylistTracks(playlistData.playlist_user, playlistData.playlist_id, {
            'offset': offset * tracksByPage, 'limit': tracksByPage
        })
            .then(function (data) {
                didLoadedTracks(data.body.items);
                managePageLabel(data.body.total);
                if (data.body.items.length == 12) {
                    $scope.currentPage = offset
                }
                $scope.$apply();
                hideLoading()
            }, function (err) {
                didGetErrorLoadingTracks(err);
                hideLoading()
            });
    }

    function didLoadedTracks(tracks) {
        console.log('Tracks loaded!');
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

    function managePageLabel(totalTracks) {
        if (totalTracks === undefined) { return }
        $scope.totalPages = Math.ceil(totalTracks / tracksByPage);
    }

    function beginCheckingCurrentStatusTrack() {
        clearInterval(timerCheckTrack);
        timerCheckTrack = setInterval(function () {
            updateCurrentTrackInfo()

            var state = spotifyPlayer.status;
            var currentTrackUri = state.track.track_resource.uri;

            //console.log('currentTrackId ->' + currentTrackId)
            //console.log('newTrackId ->' + newTrackId)
            $scope.currentRuntime = moment().startOf('day').seconds(state.playing_position).format('mm:ss');
            //console.log('track position -> ' + state.playing_position)
            //console.log('track total -> ' + $scope.nowPlayingTrack.track.duration)

            if (loadingTrack == false && (loadingTrackUri == undefined || currentTrackUri == loadingTrackUri) && state.playing_position > 5 && Math.ceil(state.playing_position) == $scope.nowPlayingTrack.track.duration - 1) {
                loadingTrack == true;
                $scope.nowPlayingTrack.track.duration = 0;
                $scope.$apply(function () {
                    playNextTrack()
                });
            }
        }, 100);
    }

    function playNextTrack() {
        console.log("Play next track");
        if ($scope.upcomingTrackList.length > 0) {
            var nextTrack = $scope.upcomingTrackList[0];
            $scope.upcomingTrackList.shift();
            playTrack(nextTrack)
        } else {
            playRandomTrack()
        }
    }

    function updateCurrentTrackInfo() {
        var status = spotifyPlayer.status;

        var trackInfo = {
            track: {
                name: status.track.track_resource.name,
                uri: status.track.track_resource.uri,
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

    function playRandomTrack() {
        console.log("Play random track")
        loadingTrack = false
    }

    function playTrack(trackInfo) {
        var playlistData = $scope.playList;
        if (playlistData !== undefined && playlistData.playlist_uri !== undefined) {
            console.log("PLAY TRACK -> " + trackInfo.track.uri + " in PLAYLIST -> " + playlistData.playlist_id);
            spotifyPlayer.player.play(trackInfo.track.uri, playlistData.playlist_uri);
            loadingTrackUri = trackInfo.track.uri;
            loadingTrack = false
        } else {
            console.log("ERROR: PLAYLIST NOT DEFINED!");
        }
    }

    function savePlayListInScope(completion) {
        storage.has('playlist', function (error, hasKey) {
            if (hasKey == true) {
                storage.get('playlist', function (error, playlistData) {
                    if (error) throw error;
                    $scope.playList = playlistData;
                    $scope.$apply();
                    completion()
                });
            } else {
                console.log("ERROR: PLAYLIST NOT DEFINED!");
            }
        });
    }

    function moveCursorRight() {
        switch ($scope.selectedButtonIndex) {
            case 1: $scope.selectedButtonIndex = 2; break;
            case 2: $scope.selectedButtonIndex = 3; break;
            case 3: $scope.selectedButtonIndex = 4; break;
            case 4: $scope.selectedButtonIndex = 5; break;
            case 5: $scope.selectedButtonIndex = 6; break;
            case 6: $scope.selectedButtonIndex = 6; break;
            case 7: $scope.selectedButtonIndex = 8; break;
            case 8: $scope.selectedButtonIndex = 9; break;
            case 9: $scope.selectedButtonIndex = 10; break;
            case 10: $scope.selectedButtonIndex = 11; break;
            case 11: $scope.selectedButtonIndex = 12; break;
            case 12: $scope.selectedButtonIndex = 12; break;
            case 13: $scope.selectedButtonIndex = 14; break;
            case 14: $scope.selectedButtonIndex = 14; break;
        }
        $scope.$apply();
    }

    function moveCursorLeft() {
        switch ($scope.selectedButtonIndex) {
            case 1: $scope.selectedButtonIndex = 1; break;
            case 2: $scope.selectedButtonIndex = 1; break;
            case 3: $scope.selectedButtonIndex = 2; break;
            case 4: $scope.selectedButtonIndex = 3; break;
            case 5: $scope.selectedButtonIndex = 4; break;
            case 6: $scope.selectedButtonIndex = 5; break;
            case 7: $scope.selectedButtonIndex = 7; break;
            case 8: $scope.selectedButtonIndex = 7; break;
            case 9: $scope.selectedButtonIndex = 8; break;
            case 10: $scope.selectedButtonIndex = 9; break;
            case 11: $scope.selectedButtonIndex = 10; break;
            case 12: $scope.selectedButtonIndex = 11; break;
            case 13: $scope.selectedButtonIndex = 13; break;
            case 14: $scope.selectedButtonIndex = 13; break;
        }
        $scope.$apply();
    }

    function moveCursorUp() {
        switch ($scope.selectedButtonIndex) {
            case 1: $scope.selectedButtonIndex = 1; break;
            case 2: $scope.selectedButtonIndex = 2; break;
            case 3: $scope.selectedButtonIndex = 3; break;
            case 4: $scope.selectedButtonIndex = 4; break;
            case 5: $scope.selectedButtonIndex = 5; break;
            case 6: $scope.selectedButtonIndex = 6; break;
            case 7: $scope.selectedButtonIndex = 1; break;
            case 8: $scope.selectedButtonIndex = 2; break;
            case 9: $scope.selectedButtonIndex = 3; break;
            case 10: $scope.selectedButtonIndex = 4; break;
            case 11: $scope.selectedButtonIndex = 5; break;
            case 12: $scope.selectedButtonIndex = 6; break;
            case 13: $scope.selectedButtonIndex = 8; break;
            case 14: $scope.selectedButtonIndex = 11; break;
        }
        $scope.$apply();
    }

    function moveCursorDown() {
        switch ($scope.selectedButtonIndex) {
            case 1: $scope.selectedButtonIndex = 7; break;
            case 2: $scope.selectedButtonIndex = 8; break;
            case 3: $scope.selectedButtonIndex = 9; break;
            case 4: $scope.selectedButtonIndex = 10; break;
            case 5: $scope.selectedButtonIndex = 11; break;
            case 6: $scope.selectedButtonIndex = 12; break;
            case 7: $scope.selectedButtonIndex = 13; break;
            case 8: $scope.selectedButtonIndex = 13; break;
            case 9: $scope.selectedButtonIndex = 13; break;
            case 10: $scope.selectedButtonIndex = 14; break;
            case 11: $scope.selectedButtonIndex = 14; break;
            case 12: $scope.selectedButtonIndex = 14; break;
            case 13: $scope.selectedButtonIndex = 13; break;
            case 14: $scope.selectedButtonIndex = 14; break;
        }
        $scope.$apply();
    }

    function manageClickEnter() {
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
                playSound('button-20');
                manageAddTrackToUpcomingList($scope.selectedButtonIndex);
                break;
            case 13:
                playSound('button-17');
                loadTracks($scope.currentPage - 1);
                break;
            case 14:
                playSound('button-17');
                loadTracks($scope.currentPage + 1);
                break;
        }
    }

    function checkAccessToken(completion) {
        storage.has('spotify_token', function (error, hasKey) {
            if (error) throw error;

            if (hasKey == true) {
                storage.get('spotify_token', function (error, data) {
                    if (error) throw error;
                    console.log("Saved token!");
                    spotifyApi.setAccessToken(data.access_token);
                    completion()
                });
            } else {
                ipcRenderer.send("request_oauth_token")
            }
        })
    }

    function showLoading() {
        $scope.loadingHidden = false
    }

    function hideLoading() {
        $scope.loadingHidden = true
    }

    // START HERE

    spotifyPlayer.player.on('ready', function () {
        console.log("Spotify app ready!");
        savePlayListInScope(function () {
            loadTracks($scope.currentPage);
            spotifyPlayer.player.play()
        })
    });
});