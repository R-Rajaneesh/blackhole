pub const NULL:i32 = 0x00;
#[derive(Eq, Hash, PartialEq, Debug, Clone)]
#[repr(C)]
pub struct Question {
    pub domain: String,
    pub qtype: u16,
    pub qclass: u16,
}
#[derive(Eq, Hash, PartialEq, Debug, Clone)]
pub struct Answer {
    pub domain: String,
    pub qtype: u16,
    pub qclass: u16,
    pub ttl: u32,
    pub resource_data_length: u16,
    pub resource_data: Vec<u8>,
}
#[derive(Eq, Hash, PartialEq, Debug, Clone, Default)]
pub struct ReadAnswer {
    pub offset: usize,
    pub domain: String,
    pub qtype: u16,
    pub qclass: u16,
    pub ttl: u32,
    pub resource_data_length: u16,
    pub resource_data: Vec<u8>,
}

#[derive(Eq, Hash, PartialEq, Debug, Clone)]
pub struct FlagDetail {
    pub query_response: u16,
    pub opcode: u16,
    pub authoritative_answer: u16,
    pub truncation: u16,
    pub recursion_desired: u16,
    pub recursion_available: u16,
    pub z: u16,
    pub response_code: u16,
}

#[derive(Eq, Hash, PartialEq, Debug, Clone)]
pub struct Header {
    pub packet_id: u16,
    pub flag: u16,
    pub query_response: u16,
    pub opcode: u16,
    pub authoritative_answer: u16,
    pub truncation: u16,
    pub recursion_desired: u16,
    pub recursion_available: u16,
    pub z: u16,
    pub response_code: u16,
    pub question_count: u16,
    pub answer_count: u16,
    pub nameserver_count: u16,
    pub additionalrecord_count: u16,
}

pub enum QuestionType {
    A = 0x01,
    NS = 0x02,
    MD = 0x03,
    MF = 0x04,
    CNAME = 0x05,
    SOA = 0x06,
    MB = 0x07,
    MG = 0x08,
    MR = 0x09,
    NULL = 0x0A,
    WKS = 0x0B,
    PTR = 0x0C,
    HINFO = 0x0D,
    MINFO = 0x0E,
    MX = 0x0F,
    TXT = 0x10,
    AAAA = 0x1c,
    AXFR = 0xFC,
    MAILB = 0xFD,
    MAILA = 0xFE,
    ALL = 0xFF,
}

pub enum QuestionClass {
    IN = 0x01,
    CS = 0x02,
    CH = 0x03,
    HS = 0x04,
}
