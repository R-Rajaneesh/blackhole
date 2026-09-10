use super::models::*;

pub fn create_packet(header: Header, question: Question, answer: Option<Answer>) -> Vec<u8> {
    let mut packet = Vec::new();
    let question_header = create_header(
        header.packet_id,
        header.flag,
        header.question_count,
        header.answer_count,
        header.nameserver_count,
        header.additionalrecord_count,
    );
    packet.extend_from_slice(&question_header);
    packet.extend_from_slice(&domain_to_bytes(question.domain));
    packet.extend_from_slice(&question.qtype.to_be_bytes());
    packet.extend_from_slice(&question.qclass.to_be_bytes());
    if !answer.is_none() {
        let ans = answer.unwrap();
        // packet.extend_from_slice(&[0xC0, 0x0C]);
        packet.extend_from_slice(&domain_to_bytes(ans.domain.clone()));
        packet.extend_from_slice(&ans.qtype.to_be_bytes());
        packet.extend_from_slice(&ans.qclass.to_be_bytes());
        packet.extend_from_slice(&ans.ttl.to_be_bytes());
        packet.extend_from_slice(&ans.resource_data_length.to_be_bytes());
        packet.extend_from_slice(&ans.resource_data);
    }
    return packet;
}

pub fn create_flag(base_flag: Option<u16>, options: FlagDetail) -> u16 {
    let mut flag = base_flag.unwrap_or(0x0000);
    flag |= options.query_response << 15;
    flag |= options.opcode << 11;
    flag |= options.authoritative_answer << 10;
    flag |= options.truncation << 9;
    flag |= options.recursion_desired << 8;
    flag |= options.recursion_available << 7;
    flag |= options.z << 4;
    flag |= options.response_code << 0;
    return flag;
}

pub fn create_header(
    packet_id: u16,
    flag: u16,
    question_count: u16,
    answer_count: u16,
    nameserver_count: u16,
    additionalrecord_count: u16,
) -> Vec<u8> {
    let mut header_buffer: Vec<u8> = Vec::with_capacity(12);
    header_buffer.extend_from_slice(&packet_id.to_be_bytes());
    header_buffer.extend_from_slice(&flag.to_be_bytes());
    header_buffer.extend_from_slice(&question_count.to_be_bytes());
    header_buffer.extend_from_slice(&answer_count.to_be_bytes());
    header_buffer.extend_from_slice(&nameserver_count.to_be_bytes());
    header_buffer.extend_from_slice(&additionalrecord_count.to_be_bytes());
    return header_buffer;
}

pub fn domain_to_bytes(domain: String) -> Vec<u8> {
    let mut buffer = Vec::new();
    for label in domain.split('.') {
        buffer.push(label.len() as u8);
        buffer.extend_from_slice(label.as_bytes());
    }
    buffer.push(0x00);
    buffer
}
