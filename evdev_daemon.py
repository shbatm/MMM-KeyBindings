#!/usr/bin/env python
# coding: utf-8

import argparse
import os
import sys
import time
import logging
import logging.config
import signal
from asyncore import file_dispatcher, loop, ExitNow
import evdev  
import json, requests
import threading
import dbus
import dbus.service
import dbus.mainloop.glib
import gobject
import re

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
        print("Couldn't find log config. Basic Level Enabled.")

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

    def handle_error(self):
        self.logger.debug("InputDeviceDispatcher Error.", exc_info=True)
        raise ExitNow

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
                    try:
                        r = requests.get(self.args.server_url, params=payload)
                        self.logger.debug("Calling url: %s\n%s", r.url, r)
                    except ConnectionError:
                        self.logger.warning("Connection Error. Could not connect to %s", self.args.server_url)
                    except Exception as err:
                        self.logger.error("Server Request Failed.", exc_info=True)
                
                self.logger.debug(kev.keycode + " " + str(kev.keystate))
                    
                if keyPressName != None:
                    kev_json = json.dumps({'KeyName': kev.keycode, 'KeyState': keyPressName, 'Duration': round(keyPressDuration,4)})
                    payload = {'notification':'KEYPRESS','payload':kev_json}
                    self.logger.info("%s: %s, duration %.2f", kev.keycode, keyPressName, round(keyPressDuration,4))
                    try:
                        r = requests.get(self.args.server_url, params=payload)
                        self.logger.debug("Calling url: %s\n%s", r.url, r)
                    except requests.exceptions.ConnectionError:
                        self.logger.warning("Connection Error. Could not connect to %s", self.args.server_url)
                    except requests.exceptions.RequestException as e:
                        self.logger.error("Server Request Failed.", exc_info=True)

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
            self.logger.debug("Starting evdev listener on '%s'", self.args.event_path)
            self.dev = evdev.InputDevice(self.args.event_path)

            if self.args.allow_grab:
                self.dev.grab()                
            
            self.listener = InputDeviceDispatcher(self.dev, self.args)
            loop()
            self.logger.warning("evdev listener on '%s' exited.", self.args.event_path)
        except OSError as err:
            err_str = str(err)
            if err_str.find("No such file or directory") > 0:
                # Restart and wait for the device to come back
                self.logger.warning("'%s' doesn't exist. Restarting and waiting for it to return", self.args.event_path, exc_info=True)
                self.start()
            elif err_str.find("Permission denied") > 0:
                self.logger.warning('''%s. Restarting and trying again. A previous script may not have exited 
                                    properly, multiple instances may be running, or maybe try with '--no-grab'.
                                    ''', self.args.event_path, exc_info=True)
                time.sleep(2)
                self.start()
        except KeyboardInterrupt:
            self.listener.close()
        except ExitNow as err:
            self.listener.close()
            self.logger.warning("Daemon Stopped. Has Bluetooth Device disconnected?", exc_info=True)
            if self.args and not self.args.bluetooth:
                self.logger.debug("Bluetooth argument not provided. Attempting evdev daemon restart to wait for device to come back.")
                time.sleep(2)
                self.start()
        except:
            self.logger.error("Unexpected Error has occurred.", exc_info=True)
            sys.exit(1)

    def stop(self):
        try:
            self.listener.close()
        except OSError:
            pass
        #self.join()

class dbusMonitor(object):
    def __init__(self, args=None):
        self.logger = logging.getLogger(__name__)
        self.args = args
        self.dev = None
        self.devices = {}
        self.deviceID = None
        self.deviceAlias = "Unknown Device"
        if args and args.bluetooth:
            self.deviceID = args.bluetooth.upper()
        self.daemon = None 
        self.connected = False

        # get the system bus
        try:
            dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
            self.bus = dbus.SystemBus()
        except Exception as ex:
            self.logger.error("Unable to get the system dbus: '{0}'. Exiting."
                          " Is dbus running?".format(ex.message), exc_info=True)
            sys.exit(1)

    def get_device_info(self, name):
        ''' Function to get a Bluetooth Device's address and event
        handler path. Will return an array with [0] = Bluetooth Address
        and [1] = eventX Path
        '''
        with open("/proc/bus/input/devices","r") as f:
            foundDev = False
            btAddr = ""
            evtPath = ""
            for line in f:
                if name in line:
                    foundDev = True
                if ("H: Handlers" in line) and foundDev and evtPath == "":
                    evt = re.search(r'event[0-9]', line, re.M|re.I)
                    if evt:
                        evtPath = '/dev/input/' + evt.group()
                if ("U: Uniq" in line) and foundDev and btAddr == "":
                    btAddr = line.split("=",1)[1].replace('\n','')
                if foundDev and btAddr and evtPath:
                    break
        f.close()
        if not foundDev:
            self.logger.warning("Device info for %s not found. May not have connected yet.", self.args.alias)
        if btAddr:
            self.deviceID = btAddr.upper()
        if evtPath:
            self.args.event_path = evtPath

    def load_devices(self):
        om = dbus.Interface(bus.get_object("org.bluez", "/"),
                "org.freedesktop.DBus.ObjectManager")
        objects = om.GetManagedObjects()
        for path, interfaces in objects.iteritems():
            if "org.bluez.Device1" in interfaces:
                self.devices[path] = interfaces["org.bluez.Device1"]
        return self.devices


    def check_connected(self):
        ''' Function to check if device is connected without waiting for an event.
            deviceID = String representing MAC Address of device to check
        '''
        btconnected = False
        self.devicePath = None
        
        if self.args and self.args.alias: 
            self.get_device_info(self.args.alias)
            self.logger.warning("Got device info for alias %s--Addr=%s Path=%s", self.args.alias, self.deviceID, self.args.event_path)
        
        if self.deviceID == None:
            return btconnected

        deviceID_corr = self.deviceID.replace(":", "_")

        # Figure out the path to the device
        manager = dbus.Interface(self.bus.get_object("org.bluez", "/"),
                            "org.freedesktop.DBus.ObjectManager")
        # bzmanager = dbus.Interface(self.bus.get_object("org.bluez", "/"),
        #                      "org.bluez.Manager")
        objects = manager.GetManagedObjects()
        
        # Section below will dump dbus data about all bluetooth devices if debug verbose enabled
        self.logger.debug("Checking dbus for device %s...", self.deviceID)
        dbus_detail_string = ""
        for path in objects.keys():
            dbus_detail_string += "[ %s ]\n" % (path)
            if path.endswith(deviceID_corr):
                self.devicePath = path
                self.logger.info("Device %s found at %s.", self.deviceID, path)
            
            # Additional Debugging Information
            if self.args.debug_mode and self.args.verbose:
                interfaces = objects[path]
                for interface in interfaces.keys():
                    if interface in ["org.freedesktop.DBus.Introspectable",
                                "org.freedesktop.DBus.Properties"]:
                        continue
                    dbus_detail_string += "    %s\n" % (interface)
                    properties = interfaces[interface]
                    for key in properties.keys():
                        dbus_detail_string += "      %s = %s\n" % (key, properties[key])

        self.logger.debug("org.bluez.Manager details:\n%s", dbus_detail_string)

        if self.devicePath:
            device = dbus.Interface(self.bus.get_object("org.bluez", self.devicePath), "org.freedesktop.DBus.Properties")
            isConnected = device.Get("org.bluez.Device1","Connected")
            self.deviceAlias = device.Get("org.bluez.Device1","Alias")
            if (isConnected):
                self.logger.debug("Device %s is already connected. Starting evdev Daemon...", self.deviceID)
                self.btconnected = True
                self.daemon = evdev_daemon(args=self.args)
                self.daemon.start()

        return btconnected

    def properties_changed(self, interface, changed, invalidated, path):
        if interface != "org.bluez.Device1":
            return
        self.logger.debug("Properties Changed for '%s': %s", path, changed)
        
        if (not self.deviceID) and self.args and self.args.alias:
            time.sleep(2)
            self.get_device_info(self.args.alias)
            self.logger.warning("Got device info for alias %s--Addr=%s Path=%s", self.args.alias, self.deviceID, self.args.event_path)

        correctDevice = (self.devicePath and path == self.devicePath) or (self.deviceID and path.endswith(self.deviceID.replace(":", "_")))
        if correctDevice and (dbus.String(u'Connected') in changed):
            connected = changed[dbus.String(u'Connected')] == dbus.Boolean(True, variant_level=1)
            if connected:
                self.logger.info("Bluetooth Device %s has connected. Starting evdev daemon...", self.deviceID)
                if self.args and self.args.alias: self.get_device_info(self.args.alias)
                self.daemon = evdev_daemon(args=self.args)
                self.connected = True
                self.daemon.start()
            else:
                self.logger.info("Bluetooth Device %s has disconnected. Stopping evdev daemon...", self.deviceID)
                self.connected = False
                self.daemon.stop()
            
    def run(self):
        if self.args.bluetooth or self.args.alias:
            self.bus.add_signal_receiver(self.properties_changed,
                    dbus_interface = "org.freedesktop.DBus.Properties",
                    signal_name = "PropertiesChanged",
                    arg0 = "org.bluez.Device1",
                    path_keyword = "path")

            self.logger.debug("Signal Receiver Attached.")
            # Bluetooth device given. Will watch for bluetooth connect/disconnects.
            self.connected = self.check_connected()

            mainloop = gobject.MainLoop()
            mainloop.run()
        else:
            # No bluetooth device passed, just have to watch the evdev only
            self.logger.info("No bluetooth address passed, starting evdev daemon only")
            self.daemon = evdev_daemon(args=self.args)
            self.daemon.start()

def shutdown(signum, frame):
    dbusMonitor.mainloop.quit()

def main():
    """
    The application entry point
    """
    app_name = os.path.splitext(os.path.basename(__file__))[0]
    script_path = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_path)

    # shut down on a TERM signal
    signal.signal(signal.SIGTERM, shutdown)

    parser = argparse.ArgumentParser(
        #prog='PROG',
        description='Runs a daemon which captures InputEvents from a device using evdev',
        epilog="That's all folks"
    )
    
    parser.add_argument('-a','--alias',
                    metavar='DEVICEALIAS',
                    type=str,
                    help='Alias/Name of Bluetooth Device.',
                    default=None,
                    dest='alias')        

    parser.add_argument('-e','--event',
                    metavar='EVENTPATH',
                    type=str,
                    help='''Path to the evdev event handler, e.g. /dev/input/event0'
                            Not required if -a|--alias is used''',
                    default='/dev/input/event0',
                    dest='event_path')

    parser.add_argument('-b','--bluetooth',
                    metavar='DEVICE',
                    type=str,
                    help='''MAC Address of Bluetooth Device.
                            Not required if -a|--alias is used''',
                    default=None,
                    dest='bluetooth')        
    
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
        else:
            log_level = logging.INFO

    setup_logging()
    logger = logging.getLogger(__name__)
    logger.setLevel(log_level)
    logging.getLogger("urllib3").setLevel(log_level)
    logger.warning("Starting %s with logging level: %s", app_name, logger.getEffectiveLevel())

    try:
        d = dbusMonitor(args=args)
        d.run()
    except KeyboardInterrupt:
        pass
    except:
        logger.error("Unable to run the gobject main loop", exc_info=True)

    logger.info("Shutting down %s" % app_name)
    sys.exit(0)

if __name__ == '__main__':
    main()
