#!/bin/bash
# Title         : preinstall.sh
# Description   : This script will create a udev symlink for a Bluetooth Remote
# Author        : shbatm
# Date          : 2018-12-03
# Version       : 0.0.1
# Usage         : ./preinstall.sh
# Notes         : This script assumes you are using an Amazon Fire TV Remote.
#               : any bluetooth device can be used, but you must change the
#               : name in the 99-btremote.rules file to match the device.
#               : To find the name, connect the device via the desktop and run
#               : either "udevadm info -a -p $(udevadm info -q path -n 
#               : /dev/input/event0) | grep ATTRS{name}" or
#               : "cat /proc/bus/input/devices" to get the Name to use.
#==============================================================================

# Copy the udev rules file to the correct location
sudo cp 99-btremote.rules /etc/udev/rules.d/
# Reload the udev rules
sudo udevadm control -R


# Check for required Debian packages
PACKAGE="libudev-dev"

if [ $(dpkg-query -W -f='${Status}' $PACKAGE 2>/dev/null | grep -c "ok installed") -eq 0 ];
then
    sudo apt update;
    sudo apt install -y $PACKAGE;
else
    echo "$PACKAGE is already installed. Moving on.";
fi
