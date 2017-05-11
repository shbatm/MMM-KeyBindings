#!/usr/bin/env python
# coding: utf-8

import argparse
import os
import sys
import time
import atexit
import logging
import signal
from asyncore import file_dispatcher, loop
import evdev  
import json, requests

class Daemon(object):
    """
    A generic daemon class.

    Usage: subclass the Daemon class and override the run() method
    """

    def __init__(self, pidfile, stdin='/dev/null',
                 stdout='/dev/null', stderr='/dev/null', args=None):
        self.stdin = stdin
        self.stdout = stdout
        self.stderr = stderr
        self.pidfile = pidfile
        self.args = args

    def daemonize(self):
        """
        do the UNIX double-fork magic, see Stevens' "Advanced 
        Programming in the UNIX Environment" for details (ISBN 0201563177)
        http://www.erlenstar.demon.co.uk/unix/faq_2.html#SEC16
        """
        # Do first fork
        self.fork()

        # Decouple from parent environment
        self.dettach_env()

        # Do second fork
        self.fork()

        # Flush standart file descriptors
        sys.stdout.flush()
        sys.stderr.flush()

        # 
        self.attach_stream('stdin', mode='r')
        self.attach_stream('stdout', mode='a+')
        self.attach_stream('stderr', mode='a+')
       
        # write pidfile
        self.create_pidfile()

    def attach_stream(self, name, mode):
        """
        Replaces the stream with new one
        """
        stream = open(getattr(self, name), mode)
        os.dup2(stream.fileno(), getattr(sys, name).fileno())

    def dettach_env(self):
        os.chdir("/")
        os.setsid()
        os.umask(0)

    def fork(self):
        """
        Spawn the child process
        """
        try:
            pid = os.fork()
            if pid > 0:
                sys.exit(0)
        except OSError as e:
            sys.stderr.write("Fork failed: %d (%s)\n" % (e.errno, e.strerror))
            sys.exit(1)

    def create_pidfile(self):
        atexit.register(self.delpid)
        pid = str(os.getpid())
        open(self.pidfile,'w+').write("%s\n" % pid)

    def delpid(self):
        """
        Removes the pidfile on process exit
        """
        os.remove(self.pidfile)

    def start(self):
        """
        Start the daemon
        """
        # Check for a pidfile to see if the daemon already runs
        pid = self.get_pid()

        if pid:
            if os.path.exists("/proc/%s" % pid):
                message = "pidfile %s already exist. Daemon already running?\n"
                sys.stderr.write(message % self.pidfile)
                sys.exit(1)
            elif os.path.exists(self.pidfile): # Delete leftover PID file
                    os.remove(self.pidfile)

        # Start the daemon
        self.daemonize()
        self.run()

    def get_pid(self):
        """
        Returns the PID from pidfile
        """
        try:
            pf = open(self.pidfile,'r')
            pid = int(pf.read().strip())
            pf.close()
        except (IOError, TypeError):
            pid = None
        return pid

    def stop(self, silent=False):
        """
        Stop the daemon
        """
        # Get the pid from the pidfile
        pid = self.get_pid()

        if not pid:
            if not silent:
                message = "pidfile %s does not exist. Daemon not running?\n"
                sys.stderr.write(message % self.pidfile)
            return # not an error in a restart

        # Try killing the daemon process    
        try:
            while True:
                os.kill(pid, signal.SIGTERM)
                time.sleep(0.1)
        except OSError as err:
            err = str(err)
            if err.find("No such process") > 0:
                if os.path.exists(self.pidfile):
                    os.remove(self.pidfile)
            else:
                sys.stdout.write(str(err))
                sys.exit(1)

    def restart(self):
        """
        Restart the daemon
        """
        self.stop(silent=True)
        self.start()

    def run(self):
        """
        You should override this method when you subclass Daemon. It will be called after the process has been
        daemonized by start() or restart().
        """
        raise NotImplementedError

class InputDeviceDispatcher(file_dispatcher):
    _pendingKeyPress = None

    def __init__(self, device, args):
        self.device = device
        self.args = args
        self._pendingKeyPress = None
        file_dispatcher.__init__(self, device)

    def recv(self, ign=None):
        return self.device.read()
        
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
                    kev_json = json.dumps({'KeyName': kev.keycode, 'KeyState': keyStateName, 'Duration': keyPressDuration})
                    payload = {'notification':'KEYPRESS','payload':kev_json}
                    r = requests.get(self.args.server_url, params=payload)
                    print(kev.keycode + " " + str(kev.keystate))
                    
                if keyPressName != None:
                    kev_json = json.dumps({'KeyName': kev.keycode, 'KeyState': keyPressName, 'Duration': keyPressDuration})
                    payload = {'notification':'KEYPRESS','payload':kev_json}
                    r = requests.get(self.args.server_url, params=payload)
                    print("%s: %s, duration %.2f" % (kev.keycode, keyPressName, keyPressDuration))
                    

        
        
class MyDaemon(Daemon):                    
    def run(self):        
        dev = evdev.InputDevice(self.args.event_path)
        if self.args.allow_grab:
            dev.grab()                
        InputDeviceDispatcher(dev, self.args)
        loop()


def main():
    """
    The application entry point
    """
    parser = argparse.ArgumentParser(
        #prog='PROG',
        description='Runs a daemon which captures InputEvents from a device using evdev',
        epilog="That's all folks"
    )
    
    parser.add_argument('operation',
                    metavar='OPERATION',
                    type=str,
                    help='Operation with daemon. Accepts any of these values: start, stop, restart, status',
                    choices=['start', 'stop', 'restart', 'status'])
    
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

    args = parser.parse_args()
    operation = args.operation

    # Daemon
    app_name = os.path.splitext(os.path.basename(__file__))[0]
    script_path = os.path.dirname(os.path.abspath(__file__))
    pid_path = script_path + '/' + app_name + '.pid'
    daemon = MyDaemon(pid_path, args=args, stdout='/dev/stdout', stderr='/dev/stderr')  # FOR DEBUGGING: Add `, stdout='/dev/stdout', stderr='/dev/stderr'`

    if operation == 'start':
        sys.stdout.write("Starting daemon\n")
        daemon.start()
        pid = daemon.get_pid()

        if not pid:
            sys.stderr.write("Unable run daemon\n")
        else:
            sys.stdout.write("Daemon is running [PID=%d]\n" % pid)

    elif operation == 'stop':
        sys.stdout.write("Stoping daemon\n")
        daemon.stop()

    elif operation == 'restart':
        sys.stdout.write("Restarting daemon\n")
        daemon.restart()
    elif operation == 'status':
        sys.stdout.write("Viewing daemon status\n")
        pid = daemon.get_pid()

        if not pid:
            sys.stdout.write("Daemon isn't running ;)\n")
        else:
            sys.stdout.write("Daemon is running [PID=%d]\n" % pid)

    sys.exit(0)

if __name__ == '__main__':
    main()