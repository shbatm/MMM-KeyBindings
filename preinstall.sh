#!/bin/bash
# Title         : preinstall.sh
# Description   : This script will create a udev symlink for a Bluetooth Remote
# Author        : shbatm
# Date          : 2021-01-09
# Version       : 0.0.2
# Usage         : ./preinstall.sh
# Notes         : This script assumes you are using an Amazon Fire TV Remote.
#               : any bluetooth device can be used, but you must change the
#               : name in the 99-btremote.rules file to match the device.
#               : To find the name, connect the device via the desktop and run
#               : either "udevadm info -a -p $(udevadm info -q path -n
#               : /dev/input/event0) | grep ATTRS{name}" or
#               : "cat /proc/bus/input/devices" to get the Name to use.
#==============================================================================

echo "Check for required Debian PACKAGE_UDEVs"
PACKAGE_BUILDESSENTIAL="build-essential"
if [ $(dpkg-query -W -f='${Status}' $PACKAGE_BUILDESSENTIAL 2>/dev/null | grep -c "ok installed") -eq 0 ]; then
  echo " Install $PACKAGE_BUILDESSENTIAL"
  sudo apt update
  sudo apt install -y $PACKAGE_BUILDESSENTIAL
else
  echo " $PACKAGE_BUILDESSENTIAL is already installed."
fi

PACKAGE_UDEV="libudev-dev"

if [ $(dpkg-query -W -f='${Status}' $PACKAGE_UDEV 2>/dev/null | grep -c "ok installed") -eq 0 ];
then
    sudo apt update
    sudo apt install -y $PACKAGE_UDEV
else
    echo "$PACKAGE_UDEV is already installed. Moving on."
fi

echo "Copy the udev rules file to the correct location"
sudo cp 99-btremote.rules /etc/udev/rules.d/

echo "Reload the udev rules"
sudo udevadm control -R
