// Minimal P2P layer over PeerJS (free cloud signalling) for 2-player co-op.
(function () {
  let peer = null, conn = null, role = 'solo';
  const cb = {};
  const fire = (n, a) => { if (cb[n]) cb[n](a); };
  function bind(c) {
    conn = c;
    c.on('open', () => fire('open'));
    c.on('data', d => fire('data', d));
    c.on('close', () => fire('close'));
    c.on('error', () => fire('err', 'conn'));
  }
  window.NET = {
    role: () => role,
    connected: () => !!(conn && conn.open),
    host(code) {
      role = 'host';
      peer = new Peer('punk-' + code);
      peer.on('open', () => fire('ready', code));
      peer.on('connection', c => bind(c));
      peer.on('error', e => fire('err', e.type || 'peer'));
    },
    join(code) {
      role = 'client';
      peer = new Peer();
      peer.on('open', () => bind(peer.connect('punk-' + code, { reliable: false })));
      peer.on('error', e => fire('err', e.type || 'peer'));
    },
    send(o) { if (conn && conn.open) conn.send(o); },
    on(n, f) { cb[n] = f; },
  };
})();
