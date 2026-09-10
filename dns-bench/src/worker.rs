use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::net::UdpSocket;
use tokio::time;

use crate::metrics::Metrics;
use crate::packet::{build_query, extract_timestamp};

pub async fn run_worker(
    target: SocketAddr,
    qps: u32,
    duration: Duration,
    randomize: bool,
) -> Metrics {
    let socket = match UdpSocket::bind("0.0.0.0:0").await {
        Ok(s) => Arc::new(s),
        Err(_) => return Metrics::new(),
    };
    
    let sock_recv = socket.clone();
    
    let recv_handle = tokio::spawn(async move {
        let mut recv_metrics = Metrics::new();
        let mut buf = [0u8; 1024];
        let end_time = time::Instant::now() + duration + Duration::from_millis(500);
        
        loop {
            if time::Instant::now() > end_time {
                break;
            }
            
            match time::timeout(Duration::from_millis(100), sock_recv.recv_from(&mut buf)).await {
                Ok(Ok((len, _))) => {
                    recv_metrics.received += 1;
                    if let Some(sent_ts) = extract_timestamp(&buf[..len]) {
                        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros() as u64;
                        let latency = now.saturating_sub(sent_ts);
                        let _ = recv_metrics.latencies.record(latency);
                    }
                }
                Ok(Err(_)) => {
                    recv_metrics.errors += 1;
                }
                Err(_) => {
                    // Timeout (100ms interval check)
                }
            }
        }
        
        recv_metrics
    });
    
    let mut sent = 0;
    
    if qps == 0 {
        let end = time::Instant::now() + duration;
        let mut buf = Vec::with_capacity(128);
        while time::Instant::now() < end {
            build_query(0x1234, &mut buf, randomize);
            if socket.send_to(&buf, target).await.is_ok() {
                sent += 1;
            }
            // Add a tiny yield to prevent entirely locking the thread if not needed,
            // though flood mode should max out CPU.
            if sent % 100 == 0 { tokio::task::yield_now().await; }
        }
    } else {
        let interval_micros = 1_000_000 / (qps as u64);
        let mut interval = time::interval(Duration::from_micros(interval_micros));
        interval.set_missed_tick_behavior(time::MissedTickBehavior::Burst);
        let mut buf = Vec::with_capacity(128);
        let total = (qps as u64) * duration.as_secs();
        for _ in 0..total {
            interval.tick().await;
            build_query(0x1234, &mut buf, randomize);
            if socket.send_to(&buf, target).await.is_ok() {
                sent += 1;
            }
        }
    }
    
    let mut final_metrics = recv_handle.await.unwrap_or_else(|_| Metrics::new());
    final_metrics.sent = sent;
    final_metrics.timeouts = sent.saturating_sub(final_metrics.received);
    final_metrics
}
