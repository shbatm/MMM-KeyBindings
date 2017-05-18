#!/usr/bin/env python
# coding: utf-8

import argparse
import os
import sys
import time
import logging
import logging.config
import signal
from asyncore import file_dispatcher, loop
import evdev  
import json, requests
import threading
import dbus
import dbus.service
import dbus.mainloop.glib
import gobject

def setup_logging(
    default_path='pylogging.json',
    default_level=logging.INFO,
    env_key='LOG_CFG'
):
    """Setup logging configuration

    """
    path = default_path
    value = os.getenv(env_key, None)
    if value:
        path = value
    if os.path.exists(path):
        with open(path, 'rt') as f:
            config = json.load(f)
        logging.config.dictConfig(config)
    else:
        logging.basicConfig(level=default_level)

class InputDeviceDispatcher(file_dispatcher):
    _pendingKeyPress = None

    def __init__(self, device, args):
        self.device = device
        self.args = args
        self._pendingKeyPress = None
        self.logger = logging.getLogger(__name__)
        file_dispatcher.__init__(self, device)

    def recv(self, ign=None):
        return self.device.read()

    def writable(self):
        ''' It has point to call handle_write only when there's something in outbox
            Having this method always returning true will cause 100% CPU usage
        '''
        return False

    def handle_read(self):
        for event in self.recv():
            if event.type == evdev.ecodes.EV_KEY:
                keyStateName = None
                keyPressName = None
                keyPressDuration = 0.0
                kev = evdev.events.KeyEvent(event)
                
                if kev.keystate == kev.key_up:
                    keyStateName = 'KEY_UP'
                    if self._pendingKeyPress != None and self._pendingKeyPress.keycode == kev.keycode:
                        keyPressDuration = kev.event.timestamp() - self._pendingKeyPress.event.timestamp()
                        keyPressName = "KEY_LONGPRESSED" if (keyPressDuration >= self.args.lp_threshold) else "KEY_PRESSED"
                    self._pendingKeyPress = None     # Clear the pending key, a full keypress has occurred or something else was pressed
                elif kev.keystate == kev.key_down:
                    keyStateName = 'KEY_DOWN'
                    self._pendingKeyPress = kev      # Store copy of KeyEvent to calculate duration
                elif kev.keystate == kev.key_hold:
                    keyStateName = 'KEY_HOLD'
                    if self._pendingKeyPress != None and self._pendingKeyPress.keycode == kev.keycode:
                        keyPressDuration = kev.event.timestamp() - self._pendingKeyPress.event.timestamp()
                    else:
                        self._pendingKeyPress = None     # Something happened, a different key was pressed
                else:
                    keyStateName = 'KEY_UNKNOWN'
                    
                if self.args.raw_mode:  # Raw mode enabled, send everything
                    kev_json = json.dumps({'KeyName': kev.keycode, 'KeyState': keyStateName, 'Duration': round(keyPressDuration,4)})
                    payload = {'notification':'KEYPRESS','payload':kev_json}
                    r = requests.get(self.args.server_url, params=payload)
                    self.logger.debug("Calling url: %s\n%s", r.url, r)
                
                self.logging.debug(kev.keycode + " " + str(kev.keystate) + '\n')
                    
                if keyPressName != None:
                    kev_json = json.dumps({'KeyName': kev.keycode, 'KeyState': keyPressName, 'Duration': round(keyPressDuration,4)})
                    payload = {'notification':'KEYPRESS','payload':kev_json}
                    r = requests.get(self.args.server_url, params=payload)
                    self.logger.info("%s: %s, duration %.2f\n", kev.keycode, keyPressName, round(keyPressDuration,4))
                    self.logger.debug("Calling url: %s\n%s", r.url, r)

class evdev_daemon(threading.Thread): 
    def __init__(self, args=None):
        threading.Thread.__init__(self)
        self.args = args
        self.dev = None
        self.logger = logging.getLogger(__name__)
        self.logger.info("Running in debug mode with args:\n%s", self.args)

    def start(self):
        # Make sure the event_path actually exists. Sometimes it gets removed if the device disconnects
        # This will wait indefinitely until the device exists again.
        while True:
            if os.path.exists(self.args.event_path):
                break
            time.sleep(0.1)

        try:
            self.logging.debug("Starting evdev listener on '%s'", self.args.event_path)
            self.dev = evdev.InputDevice(self.args.event_path)

            if self.args.allow_grab:
                self.dev.grab()                
            
            self.listener = InputDeviceDispatcher(self.dev, self.args)
            loop()
            self.logging.warning("evdev listener on '%s' exited.", self.args.event_path)
        except OSError as err:
            err_str = str(err)
            if err_str.find("No such file or directory") > 0:
                # Restart and wait for the device to come back
                self.logger.warning("'%s' doesn't exist. Restarting and waiting for it to return", self.args.event_path, exc_info=True)
                self.run()
            elif err_str.find("Permission denied") > 0:
                self.logger.error('''%s. Restarting and trying again. A previous script may not have exited 
                                    properly, multiple instances may be running, or maybe try with '--no-grab'.
                                    ''', self.args.event_path, exc_info=True)
                self.run()
        except asyncore.ExitNow as err:
            self.logger.warning("Bluetooth Device has disconnected.", exc_info=True)
        except:
            self.logger.error("Unexpected Error has occurred.", exc_info=True)
            sys.exit(1)

    def stop(self):
        self.listener.close()
        self.join()

class dbusMonitor(object):
    def __init__(self, args=None):
        self.args = args
        self.dev = None
        self.logger = logging.getLogger(__name__)
        self.daemon = evdev_daemon(args=args) 

        # get the system bus
        try:
            dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
            self.bus = dbus.SystemBus()
        except Exception as ex:
            self.logger.error("Unable to get the system dbus: '{0}'. Exiting."
                          " Is dbus running?".format(ex.message), env_key=True)
            sys.exit(1)

    def check_connected(self, deviceID):
        ''' Function to check if device is connected without waiting for an event.
            deviceID = String representing MAC Address of device to check
        '''
        btconnected = False
        deviceID = deviceID.replace(":", "_")

        # Figure out the path to the headset
        man = self.bus.get_object('org.bluez', '/')
        iface = dbus.Interface(man, 'org.bluez.Manager')
        adapterPath = iface.DefaultAdapter()
        path = adapterPath + '/dev_' + deviceID
        device = dbus.Interface(self.bus.get_object("org.bluez", path), "org.bluez.Device")
        properties = device.GetProperties()

        if (property_name == "Connected"):
            action = "connected" if value else "disconnected"
            self.logger.warning("The device %s [%s] is %s " % (properties["Alias"],
                  properties["Address"], action))
            if action == "connected":
                self.logger.warning("Device %s is already connected. Starting evdev Daemon...", deviceID)
                self.btconnected = True
                self.daemon.start()

        return btconnected


    def device_property_changed_cb(self, property_name, value, path, interface):
        device = dbus.Interface(bus.get_object("org.bluez", path), "org.bluez.Device")
        properties = device.GetProperties()

        if (property_name == "Connected"):
            action = "connected" if value else "disconnected"
            self.logger.warning("The device %s [%s] is %s " % (properties["Alias"],
                  properties["Address"], action))
            if action == "connected":
                self.daemon.start()
            elif action == "disconnected":
                self.daemon.stop()

    def run(self):
        # listen for signals on the Bluez bus
        self.bus.add_signal_receiver(self.device_property_changed_cb, bus_name="org.bluez",
                                signal_name="PropertyChanged",
                                dbus_interface="org.bluez.Device",
                                path_keyword="path", interface_keyword="interface")
        try:
            if self.args.bluetooth:
                # Bluetooth device given. Will watch for bluetooth connect/disconnects.
                self.check_connected(self.args.bluetooth)
                mainloop = gobject.MainLoop()
                mainloop.run()
            else:
                # No bluetooth device passed, just have to watch the evdev only
                self.daemon = evdev_daemon(args=args)
                self.daemon.start()
        except KeyboardInterrupt:
            pass
        except:
            logger.error("Unable to run the gobject main loop", env_key=True)

def shutdown(signum, frame):
    dbusMonitor.mainloop.quit()

def main():
    """
    The application entry point
    """

    # shut down on a TERM signal
    signal.signal(signal.SIGTERM, shutdown)

    parser = argparse.ArgumentParser(
        #prog='PROG',
        description='Runs a daemon which captures InputEvents from a device using evdev',
        epilog="That's all folks"
    )
    
    parser.add_argument('-e','--event',
                    metavar='EVENTPATH',
                    type=str,
                    help='Path to the evdev event handler, e.g. /dev/input/event0',
                    default='/dev/input/event0',
                    dest='event_path')
    
    parser.add_argument('-n','--no-grab',
                    help='''By default, this script grabs all inputs from the device, which will block
                            any commands from being passed natively. Use -n to disable''',
                    action='store_false',
                    dest='allow_grab')
    
    parser.add_argument('-r','--raw',
                    help='''Enables raw mode to send individual KEY_UP, KEY_DOWN, 
                            KEY_HOLD events instead of just KEY_PRESSED and KEY_LONGPRESSED.''',
                    action='store_true',
                    dest='raw_mode')
    
    parser.add_argument('-l','--long-press-time',
                    metavar='TIME',
                    help='Duration threshold between KEY_PRESSED and KEY_LONGPRESSED in seconds (as float). Default is 1.0s',
                    type=float,
                    dest='lp_threshold',
                    default=1.0)
    
    parser.add_argument('-s','--server',
                    metavar='SERVER',
                    type=str,
                    help='Server URL to push events.',
                    default='http://localhost:8080/MMM-KeyBindings/notify',
                    dest='server_url')

    parser.add_argument('-b','--bluetooth',
                    metavar='DEVICE',
                    type=str,
                    help='MAC Address of Bluetooth Device.',
                    default=None,
                    dest='bluetooth')        

    parser.add_argument('-d','--debug',
                    help='Enables debugging mode which will print out any key events',
                    action='store_true',
                    dest='debug_mode')

    parser.add_argument('-v','--verbose',
                    help='Enables verbose debugging mode which will print out more info. Requires -d / --debug flag',
                    action='store_true',
                    dest='verbose')

    args = parser.parse_args()

    # Setup Logging
    log_level = logging.WARNING
    if args.debug_mode:
        if args.verbose:
            log_level = logging.DEBUG
        else
            log_level = logging.INFO

    setup_logging(default_level=log_level)
    logger = logging.getLogger(__name__)

    app_name = os.path.splitext(os.path.basename(__file__))[0]
    script_path = os.path.dirname(os.path.abspath(__file__))
    
    d = dbusMonitor(args)
    d.run()

    logger.warning("Shutting down %s" % app_name)
    sys.exit(0)

if __name__ == '__main__':
    main()