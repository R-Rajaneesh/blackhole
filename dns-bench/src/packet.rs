use rand::{Rng, RngExt};
use std::time::{SystemTime, UNIX_EPOCH};

const QTYPES: &[u16] = &[1, 2, 5, 12, 15, 16, 28, 33];

fn push_hex_u64(val: u64, buf: &mut Vec<u8>) {
    const HEX: &[u8] = b"0123456789abcdef";
    for i in (0..16).rev() {
        buf.push(HEX[((val >> (i * 4)) & 0xf) as usize]);
    }
}

fn push_hex_u32(val: u32, buf: &mut Vec<u8>) {
    const HEX: &[u8] = b"0123456789abcdef";
    for i in (0..8).rev() {
        buf.push(HEX[((val >> (i * 4)) & 0xf) as usize]);
    }
}

pub fn build_query(id: u16, buf: &mut Vec<u8>, randomize: bool) {
    buf.clear();
    let mut rng = rand::rng();

    buf.push((id >> 8) as u8);
    buf.push((id & 0xff) as u8);
    buf.extend_from_slice(&[0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros() as u64;
    buf.push(16);
    push_hex_u64(now, buf);
    
    if randomize {
        let rand_part = rng.random::<u32>();
        buf.push(8);
        push_hex_u32(rand_part, buf);
        buf.push(7);
        buf.extend_from_slice(b"example");
    } else {
        buf.push(6);
        buf.extend_from_slice(b"google");
    }
    
    buf.push(3);
    buf.extend_from_slice(b"com");
    buf.push(0);

    let qtype = if randomize {
        QTYPES[rng.random_range(0..QTYPES.len())]
    } else {
        1 // Force A record for static tests to ensure cache hits
    };
    
    buf.push((qtype >> 8) as u8);
    buf.push((qtype & 0xff) as u8);

    buf.extend_from_slice(&[0x00, 0x01]);
}

pub fn extract_timestamp(buf: &[u8]) -> Option<u64> {
    if buf.len() < 12 + 17 { return None; }
    let len = buf[12];
    if len != 16 { return None; }
    
    let mut val: u64 = 0;
    for i in 0..16 {
        let b = buf[13 + i];
        let nibble = if b >= b'0' && b <= b'9' {
            b - b'0'
        } else if b >= b'a' && b <= b'f' {
            b - b'a' + 10
        } else {
            return None;
        };
        val = (val << 4) | (nibble as u64);
    }
    Some(val)
}
