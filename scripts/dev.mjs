import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)),'..');
let backendReady=false;
try { const response=await fetch('http://127.0.0.1:3001/api/health',{signal:AbortSignal.timeout(1000)}); backendReady=(await response.json()).service==='interview-pond-api'; } catch {}
const children = [...(backendReady?[]:[spawn(process.execPath,['server/index.mjs'],{cwd:root,stdio:'inherit'})]),spawn(process.execPath,['node_modules/vite/bin/vite.js',...process.argv.slice(2)],{cwd:root,stdio:'inherit'})];
let stopping = false;
function stop(code=0) { if(stopping)return; stopping=true; for(const child of children)child.kill(); process.exitCode=code; }
for(const child of children) { child.on('error',() => stop(1)); child.on('exit',code => stop(code || 0)); }
process.on('SIGINT',() => stop()); process.on('SIGTERM',() => stop());
