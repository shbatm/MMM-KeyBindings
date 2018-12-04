#!/bin/bash
# Title         : postinstall.sh
# Description   : This script will create a udev symlink for a Bluetooth Remote
# Author        : shbatm
# Date          : 2018-12-03
# Version       : 0.0.1
# Usage         : ./postinstall.sh
#==============================================================================


# Get the version of electron used by MagicMirror and rebuild native packages
ELECVERSION=$(node -pe "require('/home/pi/MagicMirror/node_modules/electron/package.json').version");
./node_modules/.bin/electron-rebuild -f -w evdev,udev -v $ELECVERSION;

exit 0;