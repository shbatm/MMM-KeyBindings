## [1.0.1] - Updates to evdev daemon for monitoring events.

Bug Fixes:

* Daemon crashes on bluetooth device disconnect & reconnects

Changes:

* Dbus monitoring for bluetooth device connection events in evdev_daemon.py. Internal evdev daemon r 
* Python logging methods for more detailed troubleshooting.
    - Logging details can be adjusted in the `'pylogging.json'` file.
* Additional error handling and automatic restarts of the daemon.

## [1.0.0] - First public release

First public release
