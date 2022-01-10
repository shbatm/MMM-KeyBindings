#!/bin/bash
# Title         : postinstall.sh
# Description   : This script will create a udev symlink for a Bluetooth Remote
# Author        : shbatm
# Date          : 2021-01-09
# Version       : 0.0.2
# Usage         : ./postinstall.sh
#==============================================================================

echo "Get the version of electron used by MagicMirror and rebuild native packages"
ELECVERSION=$(node -pe "require('../../node_modules/electron/package.json').version")
./node_modules/.bin/electron-rebuild -f -w evdev,udev -v $ELECVERSION

exit 0
