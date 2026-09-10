use super::builder::domain_to_bytes;
use super::models::*;
use std::collections::HashMap;

pub fn read_domain(buf: &[u8], offset: usize, len: usize, parts: &mut Vec<String>) {
    // Read the buffer data from the given offset
    match buf.get(offset + 1..offset + len + 1) {
        Some(part) => {
            // If data is found then push the domain part
            (*parts).push(str::from_utf8(part).unwrap().to_string());
        }
        None => {
            // This is printed if there is nothing at the buffer
            println!("Nothing found at buffer");
        }
    }
}

pub fn read_question_type_class(buf: &[u8], offset: Option<usize>) -> (u16, u16) {
    let offset = offset.unwrap_or(0);
    if offset + 4 > buf.len() {
        println!(
            "Warning: Attempted to read QTYPE/QCLASS out of bounds at offset {}",
            offset
        );
        return (0, 0);
    }
    // Type and Class are 2 bytes each stored sequentially
    let qtype = u16::from_be_bytes(buf[offset..offset + 2].try_into().unwrap());
    let qclass = u16::from_be_bytes(buf[offset + 2..offset + 4].try_into().unwrap());
    return (qtype, qclass);
}

pub fn read_question(
    buf: &[u8],
    offset: Option<usize>,
    visited: &mut HashMap<usize, String>,
) -> (usize, String, u16, u16) {
    let start_offset = offset.unwrap_or(12);
    let mut current_offset = start_offset;
    let mut parts: Vec<String> = Vec::new();
    let domain;
    loop {
        if current_offset >= buf.len() {
            println!(
                "Error: offset {} out of bounds during label parsing",
                current_offset
            );
            return (current_offset - start_offset, parts.join("."), 0, 0);
        }
        // Check if length exists
        let len = buf[current_offset] as usize;
        if len == 0 {
            current_offset += 1;
            // if it is not length and is the final null terminator, break the loop for reading the domain.
            break;
        } else if len & 0xc0 == 0xc0 {
            if current_offset + 2 > buf.len() {
                println!("Error: Malformed pointer at offset {}", current_offset);
                return (current_offset - start_offset, parts.join("."), 0, 0);
            }
            // If the question contains 0b11000000 or 0xc0 then it's an offset bit where the question is already put somewhere in the buffer and we need to read it from there by checking the offset position after  the 0xc0 byte
            let compressed_offset =
                (((len & 0x3f) << 8) | (buf[current_offset + 1] as usize)) as usize;
            // Read the offset domain that was previously stored inside a map.
            domain = visited.get(&compressed_offset).cloned().unwrap_or_default();
            current_offset += 2;
            let (qtype, qclass) = read_question_type_class(buf, Some(current_offset));
            current_offset += 4;
            let total_bytes_consumed = current_offset - start_offset;

            return (total_bytes_consumed, domain, qtype, qclass);
        } else {
            if current_offset + 1 + len > buf.len() {
                println!("Error: Label out of bounds at offset {}", current_offset);
                return (current_offset - start_offset, parts.join("."), 0, 0);
            }
            // Read the domain from the buffer and put it under visited for easier access if there is a compression somewhere else.
            read_domain(buf, current_offset, len, &mut parts);
            current_offset += len + 1;
            visited.insert(start_offset, parts.join("."));
        };
    }
    // Join the parts of the domain [{6}google{3}com] as google.com
    domain = parts.join(".");
    // Read the question type and class
    let (qtype, qclass) = read_question_type_class(buf, Some(current_offset));
    current_offset += 4;
    let total_bytes_consumed = current_offset - start_offset;
    return (total_bytes_consumed, domain, qtype, qclass);
}

pub fn read_questions(
    buf: &[u8],
    question_count: u16,
    domains: &mut Vec<Question>,
    visited: &mut HashMap<usize, String>,
) -> usize {
    let mut read_offset: usize = 12;
    for _ in 0..question_count {
        let (bytes_read, domain, qtype, qclass) = read_question(buf, Some(read_offset), visited);
        domains.push(Question {
            domain: domain.clone(),
            qtype,
            qclass,
        });
        read_offset += bytes_read;
    }
    return read_offset;
}

pub fn read_domain_name(buf: &[u8], mut offset: usize) -> (String, usize) {
    let mut domain = String::with_capacity(256);
    let mut bytes_read = 0;
    let mut jumped = false;
    let mut max_jumps = 5;

    loop {
        if max_jumps == 0 {
            break;
        }

        let len = buf[offset];
        if len == 0 {
            if !jumped {
                bytes_read += 1;
            }
            break;
        }

        // Check if it's a pointer bit 0xCC (11)
        if len & 0xC0 == 0xC0 {
            if !jumped {
                bytes_read += 2;
                jumped = true;
            }
            let b2 = buf[offset + 1] as u16;
            let pointer = (((len & 0x3F) as u16) << 8) | b2;
            offset = pointer as usize;
            max_jumps -= 1;
            continue;
        }

        offset += 1;

        if let Ok(label) = std::str::from_utf8(&buf[offset..offset + len as usize]) {
            domain.push_str(label);
            domain.push('.');
        }

        offset += len as usize;
        if !jumped {
            bytes_read += 1 + len as usize;
        }
    }

    if domain.ends_with('.') {
        domain.pop();
    }

    (domain, bytes_read)
}

pub fn read_answer(
    buf: &[u8],
    answer_offset: Option<usize>,
    visited: &mut HashMap<usize, String>,
) -> ReadAnswer {
    let start_offset = answer_offset.unwrap_or(28);
    let mut current_offset = start_offset;
    if buf[current_offset] == 0 {
        println!("The answer is 0 here {:?}", buf);
        return ReadAnswer::default();
    }
    let (bytes_read, domain, qtype, qclass) = read_question(buf, Some(current_offset), visited);
    current_offset += bytes_read;

    if current_offset + 4 > buf.len() {
        return ReadAnswer::default();
    }
    let ttl = u32::from_be_bytes(buf[current_offset..current_offset + 4].try_into().unwrap());
    current_offset += 4;

    if current_offset + 2 > buf.len() {
        return ReadAnswer::default();
    }
    let original_rd_length =
        u16::from_be_bytes(buf[current_offset..current_offset + 2].try_into().unwrap());
    current_offset += 2;

    if current_offset + original_rd_length as usize > buf.len() {
        return ReadAnswer::default();
    }

    let mut uncompressed_rdata = Vec::new();

    match qtype {
        0x05 | 0x02 => {
            // CNAME and NS
            let (expanded_domain, _) = read_domain_name(buf, current_offset);
            uncompressed_rdata = domain_to_bytes(expanded_domain);
        }
        0x06 => {
            // SOA
            let mut temp_offset = current_offset;

            let (mname, m_len) = read_domain_name(buf, temp_offset);
            temp_offset += m_len;

            let (rname, r_len) = read_domain_name(buf, temp_offset);
            temp_offset += r_len;

            uncompressed_rdata.extend_from_slice(&domain_to_bytes(mname));
            uncompressed_rdata.extend_from_slice(&domain_to_bytes(rname));

            // Append the remaining 20 bytes (Serial, Refresh, Retry, Expire, MinTTL)
            uncompressed_rdata.extend_from_slice(&buf[temp_offset..temp_offset + 20]);
        }
        0x0F => {
            // MX
            let preference = &buf[current_offset..current_offset + 2];
            let (exchange, _) = read_domain_name(buf, current_offset + 2);
            uncompressed_rdata.extend_from_slice(preference);
            uncompressed_rdata.extend_from_slice(&domain_to_bytes(exchange));
        }
        _ => {
            // A, AAAA, TXT
            uncompressed_rdata =
                buf[current_offset..current_offset + original_rd_length as usize].to_vec();
        }
    }

    current_offset += original_rd_length as usize;

    let final_rd_length = uncompressed_rdata.len() as u16;

    ReadAnswer {
        offset: current_offset,
        domain,
        qtype,
        qclass,
        ttl,
        resource_data_length: final_rd_length,
        resource_data: uncompressed_rdata,
    }
}

pub fn read_header(buf: &[u8]) -> Header {
    let packet_id = u16::from_be_bytes(buf[0..2].try_into().unwrap());
    let flag = u16::from_be_bytes(buf[2..4].try_into().unwrap());
    let query_response = (flag >> 15) & 0b1;
    let opcode = (flag >> 11) & 0b1111;
    let authoritative_answer = (flag >> 10) & 0b1;
    let truncation = (flag >> 9) & 0b1;
    let recursion_desired = (flag >> 8) & 0b1;
    let recursion_available = (flag >> 7) & 0b1;
    let z = (flag >> 4) & 0b111;
    let response_code = (flag >> 0) & 0b1111;
    let question_count = u16::from_be_bytes(buf[4..6].try_into().unwrap());
    let answer_count = u16::from_be_bytes(buf[6..8].try_into().unwrap());
    let nameserver_count = u16::from_be_bytes(buf[8..10].try_into().unwrap());
    let additionalrecord_count = u16::from_be_bytes(buf[10..12].try_into().unwrap());
    return Header {
        packet_id,
        flag,
        query_response,
        opcode,
        authoritative_answer,
        truncation,
        recursion_desired,
        recursion_available,
        z,
        response_code,
        question_count,
        answer_count,
        nameserver_count,
        additionalrecord_count,
    };
}
