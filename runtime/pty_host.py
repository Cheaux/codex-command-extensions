#!/usr/bin/env python3
"""Private stdio bridge: preserve the official CLI's PTY and foreground job control."""
import argparse
import base64
import fcntl
import json
import os
import pty
import selectors
import signal
import struct
import sys
import termios
import time

parser = argparse.ArgumentParser()
parser.add_argument('--rows', type=int, required=True)
parser.add_argument('--cols', type=int, required=True)
parser.add_argument('command', nargs=argparse.REMAINDER)
arguments = parser.parse_args()
command = arguments.command
if command and command[0] == '--':
    command = command[1:]
if not command:
    raise SystemExit('Missing terminal command')

def size(fd, rows, cols):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', max(2, rows), max(20, cols), 0, 0))

pid, master = pty.fork()
if pid == 0:
    size(0, arguments.rows, arguments.cols)
    os.execvpe(command[0], command, os.environ)

def emit(value):
    sys.stdout.write(json.dumps(value, separators=(',', ':')) + '\n')
    sys.stdout.flush()

def stop(_signal=None, _frame=None):
    try:
        os.killpg(pid, signal.SIGHUP)
    except ProcessLookupError:
        pass

signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGHUP, stop)
os.set_blocking(master, False)
selector = selectors.DefaultSelector()
selector.register(master, selectors.EVENT_READ, 'pty')
selector.register(sys.stdin.fileno(), selectors.EVENT_READ, 'control')
pending = b''
to_child = b''
try:
    running = True
    while running:
        for key, _ in selector.select(.2):
            if key.data == 'pty':
                if _ & selectors.EVENT_READ:
                    try:
                        data = os.read(master, 65536)
                    except BlockingIOError:
                        data = None
                    except OSError:
                        data = b''
                    if data == b'':
                        running = False
                        break
                    if data:
                        emit({'type': 'data', 'data': base64.b64encode(data).decode('ascii')})
                if _ & selectors.EVENT_WRITE and to_child:
                    try:
                        to_child = to_child[os.write(master, to_child):]
                    except BlockingIOError:
                        pass
                    except OSError:
                        running = False
                        break
                    if not to_child:
                        selector.modify(master, selectors.EVENT_READ, 'pty')
            else:
                data = os.read(sys.stdin.fileno(), 65536)
                if not data:
                    stop()
                    running = False
                    break
                pending += data
                if len(pending) > 8 * 1024 * 1024:
                    raise RuntimeError('Terminal control message is too large')
                while b'\n' in pending:
                    line, pending = pending.split(b'\n', 1)
                    message = json.loads(line)
                    if message['type'] == 'write':
                        to_child += base64.b64decode(message['data'])
                        if len(to_child) > 64 * 1024 * 1024:
                            raise RuntimeError('Terminal input queue is too large')
                        selector.modify(master, selectors.EVENT_READ | selectors.EVENT_WRITE, 'pty')
                    elif message['type'] == 'resize':
                        size(master, message['rows'], message['cols'])
                    elif message['type'] == 'close':
                        stop()
finally:
    selector.close()
    os.close(master)
    # Only this host's child group is signalled; shared Codex daemons are not touched.
    deadline = time.monotonic() + 2
    while True:
        ended, status = os.waitpid(pid, os.WNOHANG)
        if ended:
            break
        if time.monotonic() >= deadline:
            try:
                os.killpg(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            _, status = os.waitpid(pid, 0)
            break
        time.sleep(.02)
    emit({'type': 'exit', 'code': os.waitstatus_to_exitcode(status)})
