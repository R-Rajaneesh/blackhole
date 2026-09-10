mod metrics;
mod packet;
mod worker;

use clap::Parser;
use std::net::SocketAddr;
use std::time::Duration;
use crate::metrics::Metrics;
use crate::worker::run_worker;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = "127.0.0.1:53")]
    server: SocketAddr,

    #[arg(short, long, default_value_t = 4)]
    workers: u32,
    
    #[arg(short = 'q', long, default_value_t = 5000)]
    start_qps: u32,

    #[arg(short, long, default_value_t = 5000)]
    step: u32,
    
    #[arg(short, long, default_value_t = 3)]
    duration: u64,
    
    #[arg(short = 'r', long, default_value_t = false)]
    randomize: bool,
}

fn format_time(micros: u64) -> String {
    if micros >= 1_000_000 {
        format!("{:.2}s", micros as f64 / 1_000_000.0)
    } else if micros >= 1_000 {
        format!("{:.2}ms", micros as f64 / 1_000.0)
    } else {
        format!("{}us", micros)
    }
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    println!("Targeting server: {}", args.server);
    println!("Workers: {}", args.workers);
    println!("Test duration per step: {}s", args.duration);
    println!("Randomize domain: {}", args.randomize);

    let mut qps = args.start_qps;
    let mut max_stable_qps = 0;
    let mut max_stable_metrics = Metrics::new();
    
    println!("\nStarting auto-scaling load test (max 1% packet drop)...");

    loop {
        println!("--------------------------------------------------");
        println!("Testing at {} QPS...", qps);
        
        let qps_per_worker = qps / args.workers;
        let mut handles = vec![];
        
        for _ in 0..args.workers {
            handles.push(tokio::spawn(run_worker(
                args.server,
                qps_per_worker,
                Duration::from_secs(args.duration),
                args.randomize,
            )));
        }
        
        let mut total_metrics = Metrics::new();
        for handle in handles {
            let m = handle.await.unwrap();
            total_metrics.merge(&m);
        }
        
        let drop_rate = total_metrics.drop_rate();
        let drop_pct = drop_rate * 100.0;
        
        println!("Sent: {}", total_metrics.sent);
        println!("Received: {}", total_metrics.received);
        println!("Drops/Timeouts: {} ({:.2}%)", total_metrics.timeouts, drop_pct);
        
        if total_metrics.latencies.len() > 0 {
            println!("Latency: Min: {}, Avg: {}, p95: {}, p99: {}, Max: {}",
                format_time(total_metrics.latencies.min()),
                format_time(total_metrics.latencies.mean() as u64),
                format_time(total_metrics.latencies.value_at_percentile(95.0)),
                format_time(total_metrics.latencies.value_at_percentile(99.0)),
                format_time(total_metrics.latencies.max()),
            );
        }
        
        if drop_pct > 1.0 {
            println!("\n[RESULT] Drop rate exceeded 1%.");
            println!("[RESULT] Max stable throughput: {} QPS", max_stable_qps);
            if max_stable_metrics.latencies.len() > 0 {
                println!("[RESULT] At Max Stable Throughput:");
                println!("         Least Response Time: {}", format_time(max_stable_metrics.latencies.min()));
                println!("         Avg Response Time:   {}", format_time(max_stable_metrics.latencies.mean() as u64));
                println!("         Max Response Time:   {}", format_time(max_stable_metrics.latencies.max()));
            }
            break;
        } else {
            max_stable_qps = qps;
            max_stable_metrics = total_metrics;
            qps += args.step;
        }
    }
}
