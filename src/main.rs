use clap::Parser;
use dashmap::DashMap;
mod dns;
use dns::builder::*;
use dns::models::*;
use dns::parser::*;
use socket2::{Domain, Socket, Type};
use std::collections::HashMap;
use std::io::Result;
use std::io::{Error, ErrorKind};
use std::net::SocketAddr;
use std::sync::Arc;

async fn build_and_send_response(
    socket: Arc<tokio::net::UdpSocket>,
    src: std::net::SocketAddr,
    header: Header,
    questions: Vec<Question>,
    answers: Vec<Answer>,
    nxdomain: bool,
) {
    let mut final_answers: Vec<Answer> = Vec::with_capacity(answers.len());
    let mut final_authorities: Vec<Answer> = Vec::new();
    if answers.len() > 0 {
        for (i, answer) in answers.into_iter().enumerate() {
            let expected_qtype = questions.get(i).map(|q| q.qtype);
            if Some(answer.qtype) == expected_qtype {
                final_answers.push(answer);
            } else if answer.qtype == 0x06 {
                final_authorities.push(answer);
            }
        }
    }
    let res_flag = create_flag(
        Some(0x8000),
        FlagDetail {
            query_response: 1,
            opcode: 0,
            authoritative_answer: 0,
            truncation: 0,
            recursion_desired: header.recursion_desired,
            recursion_available: 1,
            z: 0,
            response_code: if nxdomain { 3 } else { 0 },
        },
    );
    let res_header = create_header(
        header.packet_id,
        res_flag,
        header.question_count,
        final_answers.len() as u16,
        final_authorities.len() as u16,
        0,
    );
    let mut response_buffer: Vec<u8> = Vec::new();
    response_buffer.extend_from_slice(&res_header);
    let mut question_positions: std::collections::HashMap<String, u16> =
        std::collections::HashMap::with_capacity(questions.len());
    for i in 0..questions.len() {
        let rquestion = &questions[i];
        let offset = response_buffer.len() as u16;
        question_positions.insert(rquestion.domain.clone(), offset);
        response_buffer.extend_from_slice(&domain_to_bytes(rquestion.domain.clone())[..]);
        response_buffer.extend_from_slice(&rquestion.qtype.to_be_bytes());
        response_buffer.extend_from_slice(&rquestion.qclass.to_be_bytes());
    }
    for i in 0..final_answers.len() {
        let answer = &final_answers[i];
        if let Some(&offset) = question_positions.get(&answer.domain) {
            let pointer: u16 = 0xC000 | offset;
            response_buffer.extend_from_slice(&pointer.to_be_bytes());
        } else {
            response_buffer.extend_from_slice(&domain_to_bytes(answer.domain.clone())[..]);
        };
        response_buffer.extend_from_slice(&answer.qtype.to_be_bytes());
        response_buffer.extend_from_slice(&answer.qclass.to_be_bytes());
        response_buffer.extend_from_slice(&answer.ttl.to_be_bytes());
        response_buffer.extend_from_slice(&answer.resource_data_length.to_be_bytes());
        response_buffer.extend_from_slice(&answer.resource_data);
    }
    for authority in final_authorities {
        response_buffer.extend_from_slice(&domain_to_bytes(authority.domain.clone())[..]);
        response_buffer.extend_from_slice(&authority.qtype.to_be_bytes());
        response_buffer.extend_from_slice(&authority.qclass.to_be_bytes());
        response_buffer.extend_from_slice(&authority.ttl.to_be_bytes());
        response_buffer.extend_from_slice(&authority.resource_data_length.to_be_bytes());
        response_buffer.extend_from_slice(&authority.resource_data);
    }
    if let Err(e) = socket.send_to(&response_buffer, src).await {
        eprintln!("Failed to send UDP response: {}", e);
    }
}

async fn start_listener(
    bind_addr: String,
    forwarder: String,
    cached_domains: Arc<DashMap<Question, (u32, Answer)>>,
) -> std::io::Result<()> {
    let socket = Socket::new(Domain::IPV4, Type::DGRAM, None)?;
    socket.set_reuse_port(true)?;
    socket.set_nonblocking(true)?;
    let addr: SocketAddr = bind_addr.parse().unwrap();
    socket.bind(&addr.into())?;

    let std_socket: std::net::UdpSocket = socket.into();
    let socket = Arc::new(tokio::net::UdpSocket::from_std(std_socket)?);

    loop {
        let mut buf: Vec<u8> = vec![0u8; 512];
        let (amt, src) = socket.recv_from(&mut buf).await?;
        buf.truncate(amt);

        let socket_clone = Arc::clone(&socket);
        let cached_domains_clone = Arc::clone(&cached_domains);

        let mut questions: Vec<Question> = Vec::new();
        let mut visited: HashMap<usize, String> = HashMap::new();
        let header = read_header(&buf);
        let _ = read_questions(&buf, header.question_count, &mut questions, &mut visited);

        let mut all_cached = true;
        let mut fast_answers = Vec::new();
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as u32;

        if questions.is_empty() {
            all_cached = false;
        } else {
            for question in &questions {
                if let Some(r) = cached_domains_clone.get(question) {
                    let (expires_at, answer) = r.value().clone();
                    if expires_at > current_time {
                        fast_answers.push(answer);
                    } else {
                        all_cached = false;
                        cached_domains_clone.remove(question);
                        break;
                    }
                } else {
                    all_cached = false;
                    break;
                }
            }
        }

        if all_cached {
            tokio::task::spawn(async move {
                build_and_send_response(socket_clone, src, header, questions, fast_answers, false)
                    .await;
            });
            continue;
        }

        let forwarder_clone = forwarder.clone();
        tokio::task::spawn(async move {
            let mut answers: Vec<Answer> = Vec::new();
            let mut is_nxdomain = false;
            for question in &questions {
                let packet = create_packet(header.clone(), question.clone(), None);
                match forward_request(packet, forwarder_clone.clone()).await {
                    Ok(res_buf) => {
                        let mut upstream_visited = HashMap::new();
                        let mut temp_questions: Vec<Question> = Vec::new();
                        let res_header = read_header(&res_buf);
                        if res_header.answer_count == 0 {
                            if res_header.response_code == 3 {
                                is_nxdomain = true;
                            }
                            continue;
                        }
                        let qbytes_read =
                            read_questions(&res_buf, 1, &mut temp_questions, &mut upstream_visited);
                        let answer =
                            read_answer(&res_buf, Some(qbytes_read), &mut upstream_visited);
                        if answer.domain.is_empty() && answer.ttl == 0 {
                            continue;
                        }
                        let res_answer = Answer {
                            domain: answer.domain,
                            qtype: answer.qtype,
                            qclass: answer.qclass,
                            ttl: answer.ttl,
                            resource_data_length: answer.resource_data_length,
                            resource_data: answer.resource_data,
                        };

                        cached_domains_clone.insert(
                            question.clone(),
                            (current_time + res_answer.ttl, res_answer.clone()),
                        );
                        answers.push(res_answer);
                    }
                    Err(err) => {
                        eprintln!(
                            "Request failed to forward to external DNS servers {:?}",
                            err
                        );
                    }
                }
            }
            build_and_send_response(socket_clone, src, header, questions, answers, is_nxdomain)
                .await;
        });
    }
}

#[derive(Parser, Debug, Clone)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// IP and port to listen on
    #[arg(short, long, default_value = "0.0.0.0:2053")]
    bind: String,

    /// IP and port of the upstream DNS forwarder
    #[arg(short, long, default_value = "1.1.1.1:53")]
    forwarder: String,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let args = Args::parse();
    let cached_domains: Arc<DashMap<Question, (u32, Answer)>> = Arc::new(DashMap::new());

    let cores = num_cpus::get();

    println!(
        "Starting Blackhole DNS server on {} with {} workers...",
        args.bind, cores
    );
    println!("Forwarding uncached queries to {}...", args.forwarder);

    for _ in 0..cores {
        let cache_clone = Arc::clone(&cached_domains);
        let bind_clone = args.bind.clone();
        let forwarder_clone = args.forwarder.clone();
        tokio::spawn(async move {
            start_listener(bind_clone, forwarder_clone, cache_clone)
                .await
                .unwrap();
        });
    }

    std::future::pending::<()>().await;
    Ok(())
}
async fn forward_request(upstream_request_buf: Vec<u8>, forwarder: String) -> Result<Vec<u8>> {
    let ups_socket = tokio::net::UdpSocket::bind("0.0.0.0:0").await?;
    ups_socket.connect(&forwarder).await?;
    ups_socket.send(&upstream_request_buf[..]).await?;
    let mut upstream_response_buf = [0u8; 512];
    match tokio::time::timeout(
        std::time::Duration::from_secs(2),
        ups_socket.recv(&mut upstream_response_buf),
    )
    .await
    {
        Ok(Ok(len)) => Ok(upstream_response_buf[..len].to_vec()),
        Ok(Err(e)) => Err(e), // Socket error
        Err(_) => Err(Error::new(ErrorKind::TimedOut, "Upstream timeout")), // Timeout error
    }
}

// fn read_ip_address(buf: &[u8], len: usize) -> String {
//     if buf.len() < len {
//         return String::new();
//     }

//     match len {
//         4 => buf[0..4]
//             .try_into()
//             .map(|bytes: [u8; 4]| Ipv4Addr::from(bytes).to_string())
//             .unwrap_or_default(),
//         16 => buf[0..16]
//             .try_into()
//             .map(|bytes: [u8; 16]| Ipv6Addr::from(bytes).to_string())
//             .unwrap_or_default(),
//         _ => String::new(),
//     }
// }
