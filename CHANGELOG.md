## [1.1.0] - Allow use of Bluetooth Device Alias instead of address

Changes:

* Instead of assigning both the Bluetooth Device's address and the event path in the `config`, you can now assign the BT device alias as `evdev.alias: "Some Common Device Name"`.  The script will use this to automatically find the event path and address to use.  Advantage of this method is it overcomes the issue of multiple bluetooth devices connected, which can cause the event path to change across reboots.

## [1.0.2] - Minor Bug Fixes.

Bug Fixes:

* Daemon crashes if bluetooth parameter not provided.

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
