export interface DnsQuestion {
  qname: string;
  qtype: number;
  qclass: number;
}

export interface DnsFormValues {
  id: string;
  qr: number;
  opcode: number;
  aa: number;
  tc: number;
  rd: number;
  ra: number;
  z: number;
  rcode: number;
  qdcount: number;
  ancount: number;
  nscount: number;
  arcount: number;
  questions: DnsQuestion[];
  targetIp: string;
  targetPort: number;
  useCompression: boolean;
}

export function domainToBytes(domain: string): number[] {
  if (!domain) return [0];
  const parts = domain.split('.');
  const bytes: number[] = [];
  for (const part of parts) {
    if (part.startsWith('ptr:')) {
      const offset = parseInt(part.substring(4), 10);
      if (!isNaN(offset)) {
        bytes.push(0xC0 | ((offset >> 8) & 0x3F), offset & 0xFF);
        return bytes;
      }
    }
    bytes.push(part.length);
    for (let i = 0; i < part.length; i++) {
      bytes.push(part.charCodeAt(i));
    }
  }
  bytes.push(0);
  return bytes;
}

export function buildDnsPacket(v: DnsFormValues): Uint8Array {
  const packet: number[] = [];
  
  const idValue = parseInt(v.id, 16) || 0;
  packet.push((idValue >> 8) & 0xff, idValue & 0xff);
  packet.push((v.qr << 7) | (v.opcode << 3) | (v.aa << 2) | (v.tc << 1) | v.rd);
  packet.push((v.ra << 7) | (v.z << 4) | v.rcode);
  packet.push((v.qdcount >> 8) & 0xff, v.qdcount & 0xff);
  packet.push((v.ancount >> 8) & 0xff, v.ancount & 0xff);
  packet.push((v.nscount >> 8) & 0xff, v.nscount & 0xff);
  packet.push((v.arcount >> 8) & 0xff, v.arcount & 0xff);
  
  const domainMap = new Map<string, number>();

  function writeDomain(domain: string) {
    if (!domain) {
      packet.push(0);
      return;
    }
    const parts = domain.split('.');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('ptr:')) {
        const offset = parseInt(part.substring(4), 10);
        if (!isNaN(offset)) {
          packet.push(0xC0 | ((offset >> 8) & 0x3F), offset & 0xFF);
          return;
        }
      }

      const suffix = parts.slice(i).join('.');
      if (v.useCompression && domainMap.has(suffix)) {
        const offset = domainMap.get(suffix)!;
        packet.push(0xC0 | ((offset >> 8) & 0x3F), offset & 0xFF);
        return;
      }
      
      if (v.useCompression) {
        if (packet.length < 0x3FFF) {
          domainMap.set(suffix, packet.length);
        }
      }
      
      packet.push(part.length);
      for (let j = 0; j < part.length; j++) {
        packet.push(part.charCodeAt(j));
      }
    }
    packet.push(0);
  }

  for (const q of v.questions) {
    writeDomain(q.qname);
    packet.push((q.qtype >> 8) & 0xff, q.qtype & 0xff);
    packet.push((q.qclass >> 8) & 0xff, q.qclass & 0xff);
  }
  
  return new Uint8Array(packet);
}

export function toHex(uint8Array: Uint8Array): string {
  return Array.from(uint8Array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexDump(hexString: string): string {
  let output = '';
  for (let i = 0; i < hexString.length; i += 32) {
    const chunk = hexString.slice(i, i + 32);
    let hexPairs = '';
    for (let j = 0; j < chunk.length; j += 2) {
      hexPairs += chunk.slice(j, j + 2) + ' ';
    }
    const offset = (i / 2).toString(16).padStart(4, '0');
    output += `${offset}:  ${hexPairs}\n`;
  }
  return output;
}

export function parseDnsPacket(buf: Uint8Array): any {
  let offset = 0;
  
  function read16() {
    if (offset + 1 >= buf.length) return 0;
    const val = (buf[offset] << 8) | buf[offset + 1];
    offset += 2;
    return val;
  }
  
  function read32() {
    if (offset + 3 >= buf.length) return 0;
    const val = (buf[offset] << 24) | (buf[offset+1] << 16) | (buf[offset+2] << 8) | buf[offset+3];
    offset += 4;
    return val >>> 0;
  }
  
  function readDomain() {
    const parts: string[] = [];
    let jumped = false;
    let jumpOffset = -1;
    let limit = 0;
    
    while (offset < buf.length && limit++ < 100) {
      const len = buf[offset++];
      if (len === 0) break;
      
      if ((len & 0xC0) === 0xC0) {
        const ptr = ((len & 0x3F) << 8) | buf[offset++];
        if (!jumped) { jumped = true; jumpOffset = offset; }
        offset = ptr;
      } else {
        let part = '';
        for (let i = 0; i < len; i++) {
          part += String.fromCharCode(buf[offset++]);
        }
        parts.push(part);
      }
    }
    if (jumped) offset = jumpOffset;
    return parts.join('.') || '.';
  }

  if (buf.length < 12) return { error: "Packet too small" };

  const id = read16().toString(16).padStart(4, '0');
  const flags1 = buf[offset++];
  const flags2 = buf[offset++];
  
  const qr = (flags1 >> 7) & 1;
  const opcode = (flags1 >> 3) & 0x0F;
  const aa = (flags1 >> 2) & 1;
  const tc = (flags1 >> 1) & 1;
  const rd = flags1 & 1;
  
  const ra = (flags2 >> 7) & 1;
  const z = (flags2 >> 4) & 0x07;
  const rcode = flags2 & 0x0F;
  
  const qdcount = read16();
  const ancount = read16();
  const nscount = read16();
  const arcount = read16();
  
  const header = { id, qr, opcode, aa, tc, rd, ra, z, rcode, qdcount, ancount, nscount, arcount };
  
  const questions = [];
  for (let i = 0; i < qdcount; i++) {
    const qname = readDomain();
    const qtype = read16();
    const qclass = read16();
    questions.push({ qname, qtype, qclass });
  }
  
  function readRecord() {
    if (offset >= buf.length) return null;
    const name = readDomain();
    const type = read16();
    const cls = read16();
    const ttl = read32();
    const rdlength = read16();
    
    let rdata = '';
    const endOffset = offset + rdlength;
    
    if (type === 1 && rdlength === 4) { 
      rdata = `${buf[offset]}.${buf[offset+1]}.${buf[offset+2]}.${buf[offset+3]}`;
      offset += 4;
    } else if (type === 28 && rdlength === 16) { 
      const parts = [];
      for(let j=0; j<16; j+=2) parts.push(((buf[offset+j]<<8) | buf[offset+j+1]).toString(16));
      rdata = parts.join(':');
      offset += 16;
    } else if (type === 2 || type === 5 || type === 12) { // NS, CNAME, PTR
      rdata = readDomain();
    } else if (type === 15) { // MX
      const pref = read16();
      const exchange = readDomain();
      rdata = `${pref} ${exchange}`;
    } else if (type === 16) { // TXT
      const txtParts = [];
      const end = offset + rdlength;
      while (offset < end) {
        const len = buf[offset++];
        let txt = '';
        for (let i = 0; i < len; i++) txt += String.fromCharCode(buf[offset++]);
        txtParts.push(`"${txt}"`);
      }
      rdata = txtParts.join(' ');
    } else if (type === 6) { // SOA
      const mname = readDomain();
      const rname = readDomain();
      const serial = read32();
      const refresh = read32();
      const retry = read32();
      const expire = read32();
      const minimum = read32();
      rdata = `${mname} ${rname} ${serial} ${refresh} ${retry} ${expire} ${minimum}`;
    } else if (type === 33) { // SRV
      const priority = read16();
      const weight = read16();
      const port = read16();
      const target = readDomain();
      rdata = `${priority} ${weight} ${port} ${target}`;
    } else {
      rdata = toHex(buf.slice(offset, endOffset));
      offset += rdlength;
    }
    
    offset = endOffset;
    return { name, type, class: cls, ttl, rdlength, rdata };
  }
  
  const answers = [];
  for (let i = 0; i < ancount; i++) {
    const r = readRecord();
    if(r) answers.push(r);
  }
  
  const authorities = [];
  for (let i = 0; i < nscount; i++) {
    const r = readRecord();
    if(r) authorities.push(r);
  }
  
  const additionals = [];
  for (let i = 0; i < arcount; i++) {
    const r = readRecord();
    if(r) additionals.push(r);
  }

  return { header, questions, answers, authorities, additionals };
}

export function typeToString(t: number): string {
  const types: Record<number, string> = { 1: 'A', 2: 'NS', 5: 'CNAME', 15: 'MX', 16: 'TXT', 28: 'AAAA' };
  return types[t] || t.toString();
}

export function classToString(c: number): string {
  const classes: Record<number, string> = { 1: 'IN', 3: 'CH', 4: 'HS', 255: 'ANY' };
  return classes[c] || c.toString();
}

export function generateDigOutput(parsed: any): string {
  if (!parsed) return "";
  if (parsed.error) return `Error: ${parsed.error}`;
  
  const h = parsed.header;
  let out = `;; ->>HEADER<<- opcode: ${h.opcode}, status: ${h.rcode}, id: ${h.id}\n`;
  
  const flags = [];
  if (h.qr) flags.push('qr');
  if (h.aa) flags.push('aa');
  if (h.tc) flags.push('tc');
  if (h.rd) flags.push('rd');
  if (h.ra) flags.push('ra');
  
  out += `;; flags: ${flags.join(' ')}; QUERY: ${h.qdcount}, ANSWER: ${h.ancount}, AUTHORITY: ${h.nscount}, ADDITIONAL: ${h.arcount}\n\n`;
  
  if (parsed.questions.length > 0) {
    out += `;; QUESTION SECTION:\n`;
    for (const q of parsed.questions) {
      out += `;${q.qname}.\t\t\t${classToString(q.qclass)}\t${typeToString(q.qtype)}\n`;
    }
    out += '\n';
  }
  
  if (parsed.answers.length > 0) {
    out += `;; ANSWER SECTION:\n`;
    for (const a of parsed.answers) {
      out += `${a.name}.\t\t${a.ttl}\t${classToString(a.class)}\t${typeToString(a.type)}\t${a.rdata}\n`;
    }
    out += '\n';
  }

  if (parsed.authorities.length > 0) {
    out += `;; AUTHORITY SECTION:\n`;
    for (const a of parsed.authorities) {
      out += `${a.name}.\t\t${a.ttl}\t${classToString(a.class)}\t${typeToString(a.type)}\t${a.rdata}\n`;
    }
    out += '\n';
  }
  
  if (parsed.additionals.length > 0) {
    out += `;; ADDITIONAL SECTION:\n`;
    for (const a of parsed.additionals) {
      out += `${a.name}.\t\t${a.ttl}\t${classToString(a.class)}\t${typeToString(a.type)}\t${a.rdata}\n`;
    }
    out += '\n';
  }

  return out;
}
