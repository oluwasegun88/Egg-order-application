import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const assets=Object.fromEntries(['index.html','app.js','checkout.js','admin.html','admin.js','order.html','order.js'].map(name=>['/'+name,readFileSync('dist/'+name,'utf8')]));
mkdirSync('dist/server',{recursive:true});
writeFileSync('dist/server/index.js','const assets='+JSON.stringify(assets)+';\n'+readFileSync('worker/index.js','utf8'));
console.log('Built Worker with embedded website assets.');
