const localtunnel = require('localtunnel');

async function startTunnel() {
  try {
    console.log('Attempting to connect public tunnel...');
    const tunnel = await localtunnel({ port: 3000 });
    console.log('=============================================');
    console.log('ShadowLink LIVE Public URL: ' + tunnel.url);
    console.log('=============================================');

    tunnel.on('close', () => {
      console.log('Tunnel connection lost. Reconnecting in 5 seconds...');
      setTimeout(startTunnel, 5000);
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });
  } catch (err) {
    console.error('Error establishing tunnel. Retrying in 5 seconds...', err.message);
    setTimeout(startTunnel, 5000);
  }
}

// Keep the event loop alive indefinitely
setInterval(() => {
  // Keep alive tick
}, 60000);

startTunnel();
