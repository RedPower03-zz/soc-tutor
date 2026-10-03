// Phone packet lab: display filters, a protocol tree and follow-stream.
// Pure JavaScript. Packets are already-dissected fictional frames (no raw capture).
//
// Filter language (Wireshark-ish, small):
//   tcp udp dns http tls icmp arp ip
//   ip.addr == 10.0.0.1    ip.src  ip.dst
//   tcp.port == 443        tcp.srcport  tcp.dstport  tcp.flags.syn == 1
//   udp.port == 53         http.host == intranet.example  http.request.method == GET
//   dns.qry.name contains example   tls.sni == cdn.example
//   frame contains "password"
//   &&  ||  !  ( )
// A bare protocol name keeps packets that carry that layer.

export class FilterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FilterError';
  }
}

const PROTOS = new Set(['tcp', 'udp', 'dns', 'http', 'tls', 'icmp', 'arp', 'ip', 'eth']);

export function present(p) {
  const protos = [];
  const layers = [{ name: 'Frame', fields: [['Number', String(p.no)], ['Time', `${Number(p.time).toFixed(3)} s`], ['Length', `${p.len} bytes`]] }];
  if (p.eth) {
    protos.push('eth');
    layers.push({ name: 'Ethernet II', fields: [['Source', p.eth[0]], ['Destination', p.eth[1]]] });
  }
  if (p.arp) {
    protos.push('arp');
    layers.push({ name: 'Address Resolution Protocol', fields: [['Opcode', p.arp.op], ['Sender IP', p.arp.spa], ['Sender MAC', p.arp.sha], ['Target IP', p.arp.tpa]] });
  }
  if (p.ip) {
    protos.push('ip');
    layers.push({
      name: 'Internet Protocol Version 4',
      fields: [
        ['Source', p.ip.src],
        ['Destination', p.ip.dst],
        ['Protocol', p.ip.proto || (p.tcp ? 'TCP' : p.udp ? 'UDP' : p.icmp ? 'ICMP' : '')],
        ['TTL', String(p.ip.ttl ?? 64)],
      ],
    });
  }
  if (p.tcp) {
    protos.push('tcp');
    const fl = p.tcp.flags || {};
    const flagStr = ['syn', 'ack', 'fin', 'rst', 'psh'].filter((k) => fl[k]).map((k) => k.toUpperCase()).join(',') || '—';
    layers.push({
      name: 'Transmission Control Protocol',
      fields: [
        ['Source Port', String(p.tcp.sport)],
        ['Destination Port', String(p.tcp.dport)],
        ['Flags', flagStr],
        ['Seq', p.tcp.seq != null ? String(p.tcp.seq) : ''],
        ['Ack', p.tcp.ack != null ? String(p.tcp.ack) : ''],
      ],
    });
  }
  if (p.udp) {
    protos.push('udp');
    layers.push({ name: 'User Datagram Protocol', fields: [['Source Port', String(p.udp.sport)], ['Destination Port', String(p.udp.dport)]] });
  }
  if (p.dns) {
    protos.push('dns');
    layers.push({
      name: 'Domain Name System',
      fields: [
        ['Query Name', p.dns.qry || ''],
        ['Type', p.dns.type || 'A'],
        ['Response', p.dns.answer || ''],
        ['Rcode', p.dns.rcode || (p.dns.qr ? 'NOERROR' : '')],
      ],
    });
  }
  if (p.tls) {
    protos.push('tls');
    layers.push({ name: 'Transport Layer Security', fields: [['Handshake', p.tls.msg || 'Client Hello'], ['Server Name', p.tls.sni || '']] });
  }
  if (p.http) {
    protos.push('http');
    const f = [];
    if (p.http.method) f.push(['Request Method', p.http.method], ['Host', p.http.host || ''], ['Request URI', p.http.uri || '']);
    if (p.http.status) f.push(['Status', String(p.http.status)]);
    if (p.http.body) f.push(['File Data', p.http.body]);
    layers.push({ name: 'Hypertext Transfer Protocol', fields: f });
  }
  if (p.icmp) {
    protos.push('icmp');
    layers.push({ name: 'Internet Control Message Protocol', fields: [['Type', String(p.icmp.type)], ['Code', String(p.icmp.code ?? 0)]] });
  }
  const info = p.info || layers[layers.length - 1].name;
  const raw = p.raw != null ? p.raw : [info, p.http?.body, p.dns?.qry, p.tls?.sni].filter(Boolean).join('\n');
  return { ...p, protos, layers, info, raw };
}

function flat(v) {
  if (v == null || v === '') return [];
  return Array.isArray(v) ? v.flatMap(flat) : [v];
}

function fieldValues(pkt, name) {
  const f = name.toLowerCase();
  if (f === 'ip.addr') return [pkt.ip?.src, pkt.ip?.dst];
  if (f === 'ip.src') return [pkt.ip?.src];
  if (f === 'ip.dst') return [pkt.ip?.dst];
  if (f === 'tcp.port') return [pkt.tcp?.sport, pkt.tcp?.dport];
  if (f === 'tcp.srcport') return [pkt.tcp?.sport];
  if (f === 'tcp.dstport') return [pkt.tcp?.dport];
  if (f === 'udp.port') return [pkt.udp?.sport, pkt.udp?.dport];
  if (f === 'udp.srcport') return [pkt.udp?.sport];
  if (f === 'udp.dstport') return [pkt.udp?.dport];
  if (f === 'tcp.flags.syn') return [pkt.tcp?.flags?.syn ? 1 : 0];
  if (f === 'tcp.flags.ack') return [pkt.tcp?.flags?.ack ? 1 : 0];
  if (f === 'tcp.flags.rst') return [pkt.tcp?.flags?.rst ? 1 : 0];
  if (f === 'tcp.flags.fin') return [pkt.tcp?.flags?.fin ? 1 : 0];
  if (f === 'http.host') return [pkt.http?.host];
  if (f === 'http.request.method') return [pkt.http?.method];
  if (f === 'http.request.uri') return [pkt.http?.uri];
  if (f === 'dns.qry.name') return [pkt.dns?.qry];
  if (f === 'tls.sni') return [pkt.tls?.sni];
  if (f === 'frame' || f === 'frame.text') return [pkt.raw, pkt.info];
  return [];
}

function same(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function cmpOne(value, op, raw) {
  const s = String(value);
  const n = Number(value);
  const rn = Number(raw);
  if (op === '==') return !Number.isNaN(n) && !Number.isNaN(rn) && String(raw).trim() !== '' && n === rn ? true : same(s, raw);
  if (op === '!=') return !( !Number.isNaN(n) && !Number.isNaN(rn) && String(raw).trim() !== '' && n === rn ? true : same(s, raw));
  if (op === 'contains') return s.toLowerCase().includes(String(raw).toLowerCase());
  return false;
}

// ---------------------------------------------------------------- lexer / parser

function tokenize(src) {
  const out = [];
  let i = 0;
  const s = String(src);
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') { out.push(c); i++; continue; }
    if (s.startsWith('&&', i) || s.startsWith('||', i) || s.startsWith('==', i) || s.startsWith('!=', i)) { out.push(s.slice(i, i + 2)); i += 2; continue; }
    if (c === '!') { out.push('!'); i++; continue; }
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      let body = '';
      while (j < s.length && s[j] !== q) {
        if (s[j] === '\\' && j + 1 < s.length) { body += s[j + 1]; j += 2; continue; }
        body += s[j++];
      }
      if (j >= s.length) throw new FilterError('Unclosed quote in the display filter.');
      out.push({ s: body });
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < s.length && !/[\s()!]/.test(s[j]) && !s.startsWith('&&', j) && !s.startsWith('||', j) && !s.startsWith('==', j) && !s.startsWith('!=', j)) j++;
    out.push(s.slice(i, j));
    i = j;
  }
  return out;
}

function parseFilter(src) {
  const text = String(src || '').trim();
  if (!text) return null;
  const tok = tokenize(text);
  let i = 0;
  const peek = () => tok[i];
  const eat = () => tok[i++];
  function parseOr() {
    let n = parseAnd();
    while (peek() === '||') { eat(); n = { k: 'or', a: n, b: parseAnd() }; }
    return n;
  }
  function parseAnd() {
    let n = parseNot();
    while (peek() === '&&' || (typeof peek() === 'string' && peek() !== '||' && peek() !== ')' && peek() !== '==' && peek() !== '!=' && peek() !== 'contains')) {
      // juxtaposition is AND, like Wireshark: "tcp ip.addr == 1.2.3.4"
      if (peek() === '&&') eat();
      n = { k: 'and', a: n, b: parseNot() };
    }
    return n;
  }
  function parseNot() {
    if (peek() === '!') { eat(); return { k: 'not', a: parseNot() }; }
    return parseAtom();
  }
  function parseAtom() {
    if (peek() === '(') {
      eat();
      const n = parseOr();
      if (eat() !== ')') throw new FilterError('Missing ) in the display filter.');
      return n;
    }
    const a = eat();
    if (a == null) throw new FilterError('The display filter ends early.');
    if (typeof a === 'object') throw new FilterError('A filter cannot start with a quoted string. Try frame contains "text".');
    const low = a.toLowerCase();
    if (PROTOS.has(low) && peek() !== '==' && peek() !== '!=' && peek() !== 'contains' && !String(peek() || '').startsWith('.')) return { k: 'proto', name: low };
    // field op value, or field contains value
    const op = peek();
    if (op === '==' || op === '!=' || (typeof op === 'string' && op.toLowerCase() === 'contains')) {
      eat();
      const v = eat();
      if (v == null || v === ')' || v === '||' || v === '&&') throw new FilterError(`"${a} ${op}" needs a value.`);
      const raw = typeof v === 'object' ? v.s : v;
      return { k: 'cmp', field: a, op: String(op).toLowerCase() === 'contains' ? 'contains' : op, raw };
    }
    if (low === 'frame' && typeof peek() === 'string' && peek().toLowerCase() === 'contains') {
      eat();
      const v = eat();
      if (v == null) throw new FilterError('frame contains needs a value.');
      return { k: 'cmp', field: 'frame', op: 'contains', raw: typeof v === 'object' ? v.s : v };
    }
    throw new FilterError(`Can't read "${a}" in the display filter.`, );
  }
  const ast = parseOr();
  if (i < tok.length) throw new FilterError(`Unexpected "${typeof tok[i] === 'object' ? tok[i].s : tok[i]}" in the display filter.`);
  return ast;
}

function evalNode(n, pkt) {
  if (!n) return true;
  if (n.k === 'or') return evalNode(n.a, pkt) || evalNode(n.b, pkt);
  if (n.k === 'and') return evalNode(n.a, pkt) && evalNode(n.b, pkt);
  if (n.k === 'not') return !evalNode(n.a, pkt);
  if (n.k === 'proto') return pkt.protos.includes(n.name);
  if (n.k === 'cmp') {
    const vals = flat(fieldValues(pkt, n.field)).filter((v) => v != null && v !== '');
    if (n.op === '!=') return vals.every((v) => cmpOne(v, '!=', n.raw));
    return vals.some((v) => cmpOne(v, n.op, n.raw));
  }
  return false;
}

/** Compiles a display filter to a predicate. Empty text matches everything. */
export function compileFilter(src) {
  const ast = parseFilter(src);
  return (pkt) => evalNode(ast, pkt);
}

export function applyFilter(packets, src) {
  const pred = compileFilter(src);
  return packets.filter(pred);
}

/** Ordered payload of one TCP/UDP stream, for the Follow stream view. */
export function followStream(packets, stream) {
  return packets
    .filter((p) => p.stream && p.stream === stream)
    .map((p) => ({
      id: p.id,
      time: p.time,
      src: p.ip?.src || p.eth?.[0] || '',
      dst: p.ip?.dst || p.eth?.[1] || '',
      sport: p.tcp?.sport || p.udp?.sport || '',
      dport: p.tcp?.dport || p.udp?.dport || '',
      text: p.raw || p.info || '',
    }));
}

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Scores short answers and packet picks.
 * answers: { [taskId]: string | string[] }
 * A text task hits when the answer contains any accepted synonym.
 * A pick task hits when the selected packet ids are exactly task.pick.
 */
export function scorePacketCase(def, answers = {}) {
  let got = 0;
  let max = 0;
  const rows = [];
  for (const task of def.tasks || []) {
    const w = task.weight || 1;
    max += w;
    const given = answers[task.id];
    let ok = false;
    if (task.pick) {
      const set = new Set((Array.isArray(given) ? given : String(given || '').split(/[\s,]+/)).map((x) => String(x).trim()).filter(Boolean));
      const exp = new Set(task.pick);
      ok = set.size === exp.size && [...exp].every((x) => set.has(x));
    } else {
      const g = norm(Array.isArray(given) ? given.join(' ') : given);
      ok = !!g && (task.accept || []).some((a) => g.includes(norm(a)));
    }
    if (ok) got += w;
    rows.push({ id: task.id, ok, prompt: task.prompt });
  }
  const score = max ? Math.round((100 * got) / max) : 0;
  const passAt = def.pass ?? 100;
  return { score, passed: score >= passAt, got, max, rows };
}
