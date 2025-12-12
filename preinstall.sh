#!/bin/bash
# Title         : preinstall.sh
# Description   : This script will create a udev symlink for a Bluetooth Remote
# Author        : shbatm
# Date          : 2025-12-12
# Version       : 0.0.4
# Usage         : ./preinstall.sh
# Notes         : This script assumes you are using an Amazon Fire TV Remote.
#               : any bluetooth device can be used, but you must change the
#               : name in the 99-btremote.rules file to match the device.
#               : To find the name, connect the device via the desktop and run
#               : either "udevadm info -a -p $(udevadm info -q path -n
#               : /dev/input/event0) | grep ATTRS{name}" or
#               : "cat /proc/bus/input/devices" to get the Name to use.
#==============================================================================

echo "Copy the udev rules file to the correct location"
sudo cp 99-btremote.rules /etc/udev/rules.d/

echo "Reload the udev rules"
sudo udevadm control -R
