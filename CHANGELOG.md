## [1.3.1] - Allow multiple actions for the same key (#7)

* Allow for multiple actions to be assigned to the same key, for example, different actions for "KEY_PRESSED" and "KEY_LONGPRESSED".

## [1.3.0] - [BREAKING CHANGES] Remove server controls in favor of External Modules

* Overall goal of simplifying this module.
* Removed all server-side controls from this module (monitor toggle, external interupts) in favor of declaring actions and sending notifications to other modules instead.
* Removed Notify Server in favor of extensible REST API being developed for [MMM-Remote-Control](https://github.com/Jopyth/MMM-Remote-Control/pull/104)
* Added [Actions](README.md#Actions) to send notifications on a keypress rather than rely on other modules to actively listen for them.

## [1.2.0] - Change to use native NodeJS event monitoring

* Simplified device connections by using native NodeJS modules for detecting keypresses (node-evdev and node-udev) instead of using a separate python daemon.
* Makes use of udev rules file to create a symlink to the device instead of trying to detect the event path every time the device connects.
* Removed several options under `evdev` as result of the above changes.


## [1.1.1] - Documentation Update & Mousetrap Improvements

* Improvements in Mousetrap bindings for standard keyboard keypresses
* Updated `handleKeys.js` document for including handling in other modules.
* Removed On Screen Display (OSD) code in favor of using [MMM-OnScreenMenu](https://github.com/shbatm/MMM-OnScreenMenu) with KeyBindings integration.

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
