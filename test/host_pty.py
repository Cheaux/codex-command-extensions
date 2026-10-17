"""Run arbitrary providers without importing a feature package."""
import fcntl, json, os, pathlib, pty, selectors, signal, struct, subprocess, tempfile, termios, time
from terminal_screen import screen

root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='terminal-host-pty-') as directory:
    manifest=pathlib.Path(directory)/'commands.json'
    commands=[
        {'name':'/tool-a','description':'First independent view','action':{'type':'view','executable':'${NODE}','args':['-e',"process.stdout.write('INDEPENDENT_VIEW');process.stdin.setRawMode(true);process.stdin.resume();process.stdin.once('data',()=>process.exit(0));"]}},
        {'name':'/tool-b','description':'Second independent view','action':{'type':'view','executable':'${NODE}','args':['-e',"process.stdout.write('SECOND_VIEW');process.stdin.setRawMode(true);process.stdin.resume();process.stdin.once('data',()=>process.exit(0));"]}},
        {'name':'/open','description':'Select a chat','action':{'type':'overlay','executable':'${NODE}','args':['-e',"require('node:fs').writeSync(3,JSON.stringify({type:'codex',args:['resume','selected-fixture']}));"]}},
        {'name':'/fail','description':'Failed provider','action':{'type':'overlay','executable':'${NODE}','args':['-e','process.exit(2)']}},
    ]
    manifest.write_text(json.dumps({'schemaVersion':1,'id':'fixture','commands':commands}))
    master,slave=pty.openpty()
    fcntl.ioctl(slave,termios.TIOCSWINSZ,struct.pack('HHHH',28,100,0,0))
    env={**os.environ,'TERM':'xterm-256color','CODEX_TERMINAL_DATA_DIR':directory,'CODEX_TERMINAL_CODEX_BIN':str(root/'test/fixtures/codex'),'CODEX_TERMINAL_TEST_TERMINAL':'1'}
    env.pop('CODEX_TERMINAL_WRAPPED',None)
    process=subprocess.Popen(['node',str(root/'dist/cli.js'),'launch','--extension',str(manifest),'--'],stdin=slave,stdout=slave,stderr=slave,env=env,start_new_session=True)
    os.close(slave);selector=selectors.DefaultSelector();selector.register(master,selectors.EVENT_READ);recording=bytearray()
    def wait(text,timeout=8):
        deadline=time.monotonic()+timeout
        while time.monotonic()<deadline:
            for _,_ in selector.select(.05):
                try:data=os.read(master,65536)
                except OSError:data=b''
                if not data:raise AssertionError('Host exited: '+screen(recording)[-1500:])
                recording.extend(data)
            if text in screen(recording,100,28):return
        raise AssertionError('Missing '+text+': '+screen(recording,100,28)[-1800:])
    def send(text):os.write(master,text.encode());time.sleep(.12)
    try:
        wait('FIXTURE_ORIGINAL');send('/tool-');wait('/tool-b');send('\x1b[B\t\r');wait('SECOND_VIEW');send('\r');wait('FIXTURE_ORIGINAL')
        send('/open\r');wait('FIXTURE_RESUMED selected-fixture');send('\x18b');wait('FIXTURE_ORIGINAL')
        send('/fail\r');wait('Extension exited with status 2');wait('FIXTURE_ORIGINAL')
        send('draft survives');wait('› draft survives');send('\x18b');wait('FIXTURE_RESUMED selected-fixture');send('\x04');wait('FIXTURE_ORIGINAL');wait('› draft survives')
        send('\x04');assert process.wait(timeout=5)==0
        print('PASS: modular views, overlay handoff, failed overlay, and retained sessions')
    finally:
        if process.poll() is None:
            process.terminate()
            try:process.wait(timeout=5)
            except subprocess.TimeoutExpired:process.kill();process.wait()
        selector.close();os.close(master)
