// Minimal P2P layer over PeerJS (free cloud signalling) for 2-player co-op.
// STUN works on the same Wi-Fi / friendly NAT. For mobile-data (LTE↔LTE, carrier
// NAT) a TURN relay is required — plug free TURN creds into window.COOP_TURN
// (see turn.js) and they get merged into the ICE config automatically.
(function () {
  let peer = null, conn = null, role = 'solo';
  const cb = {};
  const fire = (n, a) => { if (cb[n]) cb[n](a); };

  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  if (Array.isArray(window.COOP_TURN)) for (const s of window.COOP_TURN) iceServers.push(s);   // optional TURN relays
  const peerOpts = { config: { iceServers, sdpSemantics: 'unified-plan' }, debug: 1 };

  function bind(c) {
    conn = c;
    c.on('open', () => fire('open'));
    c.on('data', d => fire('data', d));
    c.on('close', () => fire('close'));
    c.on('error', e => fire('err', (e && e.type) || 'conn'));
  }
  function watchServer(p) { p.on('disconnected', () => { try { p.reconnect(); } catch (e) {} }); }

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
