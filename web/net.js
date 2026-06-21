// 2-player co-op transport over a free public MQTT broker (WebSocket).
// Both players connect OUTBOUND to the broker, which relays messages between
// them — so it works on ANY network (different Wi-Fi, LTE, NAT, AP-isolation),
// with no TURN and no registration. Same NET API as before.
(function () {
  let client = null, role = 'solo', connected = false, topicOut = '', topicIn = '', hello = null;
  const cb = {};
  const fire = (n, a) => { if (cb[n]) cb[n](a); };

  // Public MQTT brokers (secure WebSocket, required on GitHub Pages), ordered by
  // measured latency — EU brokers first (lowest ping for UA), EMQX last (~3× slower).
  const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
  let bi = 0;

  function start(code, mineOut, mineIn, isHost) {
    role = isHost ? 'host' : 'client';
    topicOut = 'punktown/' + code + '/' + mineOut;
    topicIn = 'punktown/' + code + '/' + mineIn;
    connectBroker(code, isHost);
  }
  function connectBroker(code, isHost) {
    const id = 'punk-' + code + '-' + Math.floor(Math.random() * 1e9).toString(36);
    let opened = false;
    client = mqtt.connect(BROKERS[bi], { clientId: id, clean: true, connectTimeout: 7000, reconnectPeriod: 3000, keepalive: 30 });

    client.on('connect', () => {
      opened = true;
      client.subscribe(topicIn, { qos: 0 }, err => { if (err) fire('err', 'subscribe'); });
      if (isHost) fire('ready', code);
      startHello();
    });
    client.on('message', (t, payload) => {
      let d; try { d = JSON.parse(payload.toString()); } catch (e) { return; }
      if (!connected) { connected = true; stopHello(); fire('open'); }
      if (d && d.t !== '__hello') fire('data', d);
    });
    client.on('error', () => { if (!opened) tryNextBroker(code, isHost); });
    client.on('close', () => { if (connected) { connected = false; stopHello(); fire('close'); } });
  }
  function tryNextBroker(code, isHost) {
    // first broker unreachable → fall back to the next one
    try { client.end(true); } catch (e) {}
    bi++;
    if (bi < BROKERS.length) connectBroker(code, isHost);
    else { bi = 0; fire('err', 'broker'); }
  }
  function startHello() {
    // both sides beat a hello until the link is confirmed, so join order doesn't matter
    const beat = () => { if (client && client.connected) client.publish(topicOut, JSON.stringify({ t: '__hello' }), { qos: 0 }); };
    beat(); stopHello(); hello = setInterval(beat, 1000);
  }
  function stopHello() { if (hello) { clearInterval(hello); hello = null; } }

  window.NET = {
    role: () => role,
    connected: () => connected,
    host(code) { start(code, 'h2c', 'c2h', true); },
    join(code) { start(code, 'c2h', 'h2c', false); },
    send(o) { if (client && client.connected) client.publish(topicOut, JSON.stringify(o), { qos: 0 }); },
    on(n, f) { cb[n] = f; },
  };
})();
