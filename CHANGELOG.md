# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add links and dates to CHANGELOG

### Changed

- Update dependencies

### Removed

- Remove `simple-setup`, because it was not working as expected.
- Remove old `.snyk` file

## [1.3.5] Maintenance update - 2025-02-22

### Added

- Add linter, formatter and spellchecker

### Changed

- Update dependencies
- Move "@electron/rebuild" from devDependencies to dependencies (because it's part of the postinstall process)

### Removed

- Remove "node-gyp" because it's part of "@electron/rebuild"
- Handle linter, formatter and spelling issues

## [1.3.4] - 2025-02-20

### Added

- Add simple-setup (#26)
- Add link to Code of Conduct into README
- Add Update section to README

### Changed

- Refactored node helper to allow specifying multiple evdev readers (#24)
- Update Code of Conduct to version 2.1
- Change LICENSE format to markdown
- Order `package.json` in npm standard way

### Fixed

- Fix typos

### Removed

- Remove jshint entries

## [1.3.3] Maintenance update - 2024-02-28

- Switch from electron-rebuild to @electron/rebuild
- Update dependencies
- Format code and markdown files

## [1.3.2] Fix installation problems and minor changes - 2022-02-01

- Fix installation problems (#10)
- Update dependencies
- Code cleanup

## [1.3.1] Allow multiple actions for the same key (#7) - 2019-02-02

- Allow for multiple actions to be assigned to the same key, for example, different actions for "KEY_PRESSED" and "KEY_LONGPRESSED".

## [1.3.0] [BREAKING CHANGES] Remove server controls in favor of external modules - 2019-01-03

- Overall goal of simplifying this module.
- Removed all server-side controls from this module (monitor toggle, external interrupts) in favor of declaring actions and sending notifications to other modules instead.
- Removed Notify Server in favor of extensible REST API being developed for [MMM-Remote-Control](https://github.com/Jopyth/MMM-Remote-Control/pull/104)
- Added [Actions](README.md#Actions) to send notifications on a keypress rather than rely on other modules to actively listen for them.

## [1.2.0] Change to use native NodeJS event monitoring - 2018-12-24

- Simplified device connections by using native NodeJS modules for detecting keypresses (node-evdev and node-udev) instead of using a separate python daemon.
- Makes use of udev rules file to create a symlink to the device instead of trying to detect the event path every time the device connects.
- Removed several options under `evdev` as result of the above changes.

## [1.1.1] Documentation Update & Mousetrap Improvements - 2017-06-24

- Improvements in Mousetrap bindings for standard keyboard keypresses
- Updated `handleKeys.js` document for including handling in other modules.
- Removed On Screen Display (OSD) code in favor of using [MMM-OnScreenMenu](https://github.com/shbatm/MMM-OnScreenMenu) with KeyBindings integration.

## [1.1.0] Allow use of Bluetooth Device Alias instead of address - 2017-06-01

Changes:

- Instead of assigning both the Bluetooth Device's address and the event path in the `config`, you can now assign the BT device alias as `evdev.alias: "Some Common Device Name"`. The script will use this to automatically find the event path and address to use. Advantage of this method is it overcomes the issue of multiple bluetooth devices connected, which can cause the event path to change across reboots.

## [1.0.2] Minor Bug Fixes - 2017-05-21

Bug Fixes:

- Daemon crashes if bluetooth parameter not provided.

## [1.0.1] Updates to evdev daemon for monitoring events - 2017-05-19

Bug Fixes:

- Daemon crashes on bluetooth device disconnect & reconnects

Changes:

- D-Bus monitoring for bluetooth device connection events in evdev_daemon.py. Internal evdev daemon r
- Python logging methods for more detailed troubleshooting.
  - Logging details can be adjusted in the `'pylogging.json'` file.
- Additional error handling and automatic restarts of the daemon.

## [1.0.0] First public release - 2017-05-10

First public release

[1.3.5]: https://github.com/shbatm/MMM-KeyBindings/compare/v1.3.4...v1.3.5
[1.3.4]: https://github.com/shbatm/MMM-KeyBindings/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/shbatm/MMM-KeyBindings/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/shbatm/MMM-KeyBindings/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/shbatm/MMM-KeyBindings/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/shbatm/MMM-KeyBindings/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/shbatm/MMM-KeyBindings/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/shbatm/MMM-KeyBindings/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/shbatm/MMM-KeyBindings/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/shbatm/MMM-KeyBindings/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/shbatm/MMM-KeyBindings/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/shbatm/MMM-KeyBindings/releases/tag/v1.0.0
