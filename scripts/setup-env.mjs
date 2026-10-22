import {randomBytes} from 'node:crypto';import {existsSync,writeFileSync} from 'node:fs';
if(!existsSync('.env')){writeFileSync('.env',`STAGEFLOW_JWT_SECRET=${randomBytes(48).toString('hex')}\n`);console.log('Local deployment secret created in .env');}else console.log('Existing .env preserved');
