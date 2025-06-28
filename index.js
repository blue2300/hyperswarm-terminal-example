/** @typedef {import('pear-interface')} */
import Hyperswarm from 'hyperswarm';
import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import readline from 'bare-readline';
import tty from 'bare-tty';
import process from 'bare-process';

const { teardown, config, updates } = Pear;
const peerKey = config.args.pop();


const swarm = new Hyperswarm();
await swarm.listen(console.log('Listening'))

// Display the local public key
console.log('My public key:', b4a.toString(swarm.keyPair.publicKey, 'hex'));

// Clean up swarm on process exit
teardown(() => swarm.destroy());

// Enable auto-reload for development
updates(() => Pear.reload());

const rl = readline.createInterface({
  input: new tty.ReadStream(0),
  output: new tty.WriteStream(1)
});

// Handle new peer connections
swarm.on('connection', peer => {
  const name = b4a.toString(peer.remotePublicKey, 'hex').substr(0, 6);
  console.log(`[info] Connected to peer: ${name}`);
  peer.on('data', message => appendMessage({ name, message }));
  peer.on('error', e => console.log(`Connection error: ${e}`));
});

// Update peer connection count
swarm.on('update', () => {
  console.log(`[info] Number of connections: ${swarm.connections.size}`);
});

// Connect to peer if key provided, otherwise wait for connections
if (peerKey) {
  joinPeer(peerKey);
} else {
  console.log('[info] Waiting for incoming connections...');
}

rl.input.setMode(tty.constants.MODE_RAW);
rl.on('data', line => {
  sendMessage(line);
  rl.prompt();
});
rl.prompt();

rl.on('close', () => {
  process.kill(process.pid, 'SIGINT');
});

async function joinPeer(peerKeyStr) {
  const peerKeyBuffer = b4a.from(peerKeyStr, 'hex');
  swarm.joinPeer(peerKeyBuffer);
  await swarm.flush();
  console.log(`[info] Attempting to connect to peer: ${peerKeyStr.substr(0, 6)}`);
}

function sendMessage(message) {
  const peers = [...swarm.connections];
  for (const peer of peers) peer.write(message);
}

function appendMessage({ name, message }) {
  console.log(`[${name}] ${message}`);
}
