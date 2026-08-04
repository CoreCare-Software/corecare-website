import { readdir } from 'node:fs/promises';

const files=(await readdir(new URL('../migrations/',import.meta.url))).filter(file=>file.endsWith('.sql')).sort();
const legacyDuplicates=new Set(['0042']);
const seen=new Map();
for(const file of files){
  const prefix=file.match(/^(\d{4})_/u)?.[1];
  if(!prefix)throw new Error(`Migration ${file} must start with a four-digit sequence.`);
  if(seen.has(prefix)&&!legacyDuplicates.has(prefix))throw new Error(`Duplicate migration sequence ${prefix}: ${seen.get(prefix)} and ${file}.`);
  seen.set(prefix,file);
}
const latest=Math.max(...[...seen.keys()].map(Number));
if(!Number.isFinite(latest))throw new Error('No migrations were found.');
console.log(`Validated ${files.length} migrations; latest sequence is ${String(latest).padStart(4,'0')}.`);
