// Re-encode existing artwork using Chrome's WebP encoder; no runtime dependency.
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const profile = await mkdtemp(join(tmpdir(), 'maple-image-'))
const browser = spawn(process.env.CHROME_BINARY || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {windowsHide:true, stdio:'ignore'})
let socket
try {
  let port
  for(let i=0; i<100; i++) {
    try { port = (await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]; break } catch { await new Promise(r=>setTimeout(r,100)) }
  }
  if(!port) throw Error('Chrome did not start')
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  socket = new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
  let id=0
  const requests=new Map()
  socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){requests.get(message.id)(message);requests.delete(message.id)}}
  const evaluate=async expression=>{
    const next=++id
    const promise=new Promise(resolve=>requests.set(next,resolve))
    socket.send(JSON.stringify({id:next,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}))
    const response=await promise
    if(response.error || response.result.exceptionDetails) throw Error(JSON.stringify(response))
    return response.result.result.value
  }
  for(const [source,outputs] of [
    ['star.png', [['star.webp',128]]],
    ['floating-islands.png', [['floating-islands.webp',1600],['floating-islands-mobile.webp',800]]],
    ['maple_character_day_large.png', [['maple-character-day.webp',800]]],
    ['floating-island-night.png', [['floating-islands-night.webp',1600],['floating-islands-night-mobile.webp',800]]],
    ['maple_character_night_large.png', [['maple-character-night.webp',800]]],
  ]) {
    if(process.argv[2] && source !== process.argv[2]) continue
    const data=(await readFile(new URL(`../public/images/workshop/${source}`,import.meta.url))).toString('base64')
    for(const [name,maxWidth] of outputs) {
      const result=await evaluate(`(async()=>{const img=new Image();img.src='data:image/png;base64,${data}';await img.decode();const canvas=document.createElement('canvas');const ratio=Math.min(1,${maxWidth}/img.width);canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/webp',.82).split(',')[1]})()`)
      const bytes=Buffer.from(result,'base64')
      await writeFile(new URL(`../public/images/workshop/${name}`,import.meta.url),bytes)
      console.log(`${name}: ${bytes.length} bytes`)
    }
  }
} finally {socket?.close();browser.kill()}
