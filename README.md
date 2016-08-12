[Arcade Jukebox for Spotify™][1]
=========================

![alt tag](http://theclashsoft.com/jukebox_spotify.png)

Turn your Spotify music library into a beautiful old-style arcade Jukebox!!

Developed by [Javier Aznar][2]. Made with the awesome [Electron framework][4] and [AngularJS][5]

No affiliation with [Spotify][3].

[1]: https://github.com/javikr/jukebox-spotify-electron
[2]: http://www.theclashsoft.com
[3]: http://www.spotify.com/
[4]: http://electron.atom.io/
[5]: https://angularjs.org/

Features
------------

* Beautiful arcade jukebox frontend for the Spotify official desktop app.
* Easy customizable: html & css styles.
* Keyboard mapped: great for arcade boxes, bartops, etc...
* Login with your Spotify account.
* Select a playlist to load it on the Jukebox.

How to install
------------

Download a compiled package for Windows or Mac:
[Releases](https://github.com/javikr/jukebox-spotify-electron/releases)

Compile and run yourself:

```sh 
$ git clone https://github.com/javikr/jukebox-spotify-electron.git
$ npm install
$ npm start 
```


How to use
------------

1) Launch the Jukebox and the Spotify desktop app.
2) Login with your Spotify account. (only the first time)
3) Select a playlist from the main menu.
4) Press the number key '5' to add credits.
5) Move the cursor using the arrow keys.
6) Select a track pressing the number key '1'
7) The track will be added to the queue!
8) Enjoy :)


Requirements
------------

* Mac OS X 10.8 or later
* Windows 7 or later.
* Spotify desktop app installed.


Development
-----------

This project was made using [Electron][4] and uses npm package manager and bower to handle all its dependencies. It depends on the Spotify API to make all the API calls to obtain tracks, playlists, user data, etc..
The Jukebox acts as a frontend for the Spotify desktop app so it needs the Spotify desktop app running while the Jukebox app is open.



License
-------

The MIT License (MIT)

Copyright (c) 2016 Javier Aznar

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.