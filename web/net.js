// Minimal P2P layer over PeerJS (free cloud signalling) for 2-player co-op.
// Includes free TURN relays so two phones on mobile/LTE (carrier NAT) can connect.
(function () {
  let peer = null, conn = null, role = 'solo';
  const cb = {};
  const fire = (n, a) => { if (cb[n]) cb[n](a); };

  // ICE servers: Google STUN + free Open-Relay TURN (TURN is what makes LTE↔LTE work)
  const ICE = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
    sdpSemantics: 'unified-plan',
  };
  const peerOpts = { config: ICE, debug: 1 };

  function bind(c) {
    conn = c;
    c.on('open', () => fire('open'));
    c.on('data', d => fire('data', d));
    c.on('close', () => fire('close'));
    c.on('error', e => fire('err', (e && e.type) || 'conn'));
  }
  function watchServer(p) {
    // keep the signalling link alive (mobile browsers drop it when backgrounded)
    p.on('disconnected', () => { try { p.reconnect(); } catch (e) {} });
  }

  window.NET = {
    role: () => role,
    connected: () => !!(conn && conn.open),
    host(code) {
      role = 'host';
      peer = new Peer('punk-' + code, peerOpts);
      watchServer(peer);
      peer.on('open', () => fire('ready', code));
      peer.on('connection', c => bind(c));
      peer.on('error', e => fire('err', (e && e.type) || 'peer'));
    },
    join(code) {
      role = 'client';
      peer = new Peer(peerOpts);
      watchServer(peer);
      peer.on('open', () => bind(peer.connect('punk-' + code, { reliable: true })));
      peer.on('error', e => fire('err', (e && e.type) || 'peer'));
    },
    send(o) { if (conn && conn.open) conn.send(o); },
    on(n, f) { cb[n] = f; },
  };
})();
