#!/usr/bin/env python
# coding: utf-8

import argparse
import os
import sys
import time
#import atexit
#import logging
import signal
from asyncore import file_dispatcher, loop
import evdev  
import json, requests

class InputDeviceDispatcher(file_dispatcher):
    _pendingKeyPress = None

    def __init__(self, device, args):
        self.device = device
        self.args = args
        self._pendingKeyPress = None
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
                    if self.args.debug_mode and self.args.verbose:
                        print(r.url)
                        print(r)
                
                if self.args.debug_mode and self.args.verbose: 
                    sys.stdout.write(kev.keycode + " " + str(kev.keystate) + '\n')
                    
                if keyPressName != None:
                    kev_json = json.dumps({'KeyName': kev.keycode, 'KeyState': keyPressName, 'Duration': round(keyPressDuration,4)})
                    payload = {'notification':'KEYPRESS','payload':kev_json}
                    r = requests.get(self.args.server_url, params=payload)
                    if self.args.debug_mode: 
                        sys.stdout.write("%s: %s, duration %.2f\n" % (kev.keycode, keyPressName, round(keyPressDuration,4)))
                        if self.args.verbose:
                            print(r.url)
                            print(r)

class evdev_daemon(object): 
    def __init__(self, args=None):
        self.args = args
        self.dev = None

    def run(self):
        if self.args.debug_mode:
            sys.stdout.write("Running in debug mode with args:\n")
            print(self.args)

        # Make sure the event_path actually exists. Sometimes it gets removed if the device disconnects
        # This will wait indefinitely until the device exists again.
        while True:
            if os.path.exists(self.args.event_path):
                break
            time.sleep(0.1)

        try:
            self.dev = evdev.InputDevice(self.args.event_path)

            if self.args.allow_grab:
                self.dev.grab()                
            
            InputDeviceDispatcher(self.dev, self.args)
            loop()
        except OSError as err:
            err_str = str(err)
            if err_str.find("No such file or directory") > 0:
                # Restart and wait for the device to come back
                if self.args.debug_mode:
                    sys.stdout.write("'%s' doesn't exist. Restarting and waiting for it to return" % (self.args.event_path))
                self.run()
            elif err_str.find("Permission denied") > 0:
                if self.args.debug_mode:
                    sys.stdout.write("%s. Restarting and trying again. A previous script may not have exited properly, or maybe try with '--no-grab'" % (self.args.event_path))
                self.run()
            else:
                print(err)
                #sys.stdout.write(str(err))
                sys.exit(1)




def main():
    """
    The application entry point
    """
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

    parser.add_argument('-d','--debug',
                    help='Enables debugging mode which will print out any key events',
                    action='store_true',
                    dest='debug_mode')

    parser.add_argument('-v','--verbose',
                    help='Enables verbose debugging mode which will print out more info. Requires -d / --debug flag',
                    action='store_true',
                    dest='verbose')

    args = parser.parse_args()

    # Daemon
    app_name = os.path.splitext(os.path.basename(__file__))[0]
    script_path = os.path.dirname(os.path.abspath(__file__))
    daemon = evdev_daemon(args=args) 

    try: 
        daemon.run()
    except KeyboardInterrupt:
        sys.exit(1)

    sys.exit(0)

if __name__ == '__main__':
    main()