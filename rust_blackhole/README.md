<div align="center">
  <h1>🕳️ Blackhole DNS</h1>
  <p><strong>A blazing fast, multi-threaded caching DNS proxy written in Rust.</strong></p>

  <p>
    <a href="https://github.com/rust-lang/rust"><img src="https://img.shields.io/badge/Rust-1.80%2B-orange.svg" alt="Rust Version"></a>
    <a href="https://github.com/tokio-rs/tokio"><img src="https://img.shields.io/badge/Powered%20by-Tokio-blue.svg" alt="Tokio"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License"></a>
  </p>
</div>

---

**Blackhole** is a high-performance, asynchronous DNS proxy and caching server built from the ground up in Rust. Designed to sit between your local network and upstream public DNS resolvers (like Cloudflare or Google), it aggressively caches responses to deliver **sub-10-millisecond** resolution times for downstream clients.

Whether you're building a local ad-blocker, speeding up enterprise network requests, or just exploring Rust networking, Blackhole is built for speed and concurrency.

## ✨ Features

- **🚀 Synchronous Fast-Path Caching:** Cache hits are served instantly via a synchronous fast-path that entirely bypasses the async task scheduler, ensuring ultra-low latency and zero task-queue congestion.
- **🧵 Multi-Core Scaling:** Leverages `SO_REUSEPORT` via the `socket2` crate, allowing you to spin up multiple lock-free UDP listeners across all your CPU cores.
- **⚡ Async Upstream Proxying:** Built on `tokio`, un-cached requests are resolved concurrently upstream (default `1.1.1.1:53`) without blocking the main event loops.
- **🔒 Thread-Safe Shared Cache:** Powered by `DashMap`, delivering lock-free, highly concurrent read/write access to the DNS cache across all worker threads.
- **🛡️ Robust Protocol Parsing:** Fully modularized DNS protocol parser supporting A, AAAA, CNAME, MX, SOA, and more.
- **📉 Intelligent Expiration:** Cache entries are validated against absolute UNIX Epoch timestamps for mathematically accurate TTL enforcement.
- **🛠️ Built-in Benchmarking:** Includes `dns-bench`, a custom auto-scaling load testing tool designed to push the server to its limits.

## 🚀 Getting Started

### Prerequisites

You will need Rust and Cargo installed on your system.
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Building and Running

Clone the repository and run the server using Cargo:

```bash
git clone https://github.com/r-rajaneesh/blackhole.git
cd blackhole/rust_blackhole

# Build and run the server in release mode for maximum performance
cargo run --release
```

The server will automatically bind to `0.0.0.0:53` and begin listening for incoming UDP DNS queries.

### Testing the Server

You can query the server locally using `dig`:

```bash
dig @127.0.0.1 -p 53 google.com
```

You should notice that the first request takes ~20-50ms (forwarded upstream), while all subsequent requests for the duration of the TTL take **< 1ms** (served directly from the fast-path cache).

## 🏎️ Benchmarking

Blackhole comes with a custom, high-throughput load testing tool called `dns-bench` specifically designed to saturate the server's cache.

```bash
cd test_tools/dns-bench

# Run a test against the server targeting 10,000 queries per second
cargo run --release -- -s 127.0.0.1:53 --workers 4 -q 10000 --step 10000 --duration 3
```

## 🏗️ Architecture

The codebase has been meticulously structured for modularity and ease of contribution:
- **`src/main.rs`**: The networking entry point. Manages the Tokio runtime, UDP socket binding (`SO_REUSEPORT`), the `DashMap` cache, and the fast-path listener loop.
- **`src/dns/models.rs`**: Contains all core DNS data structures (`Question`, `Answer`, `Header`, etc.).
- **`src/dns/parser.rs`**: The deserialization engine for parsing raw byte buffers from the wire into Rust structs.
- **`src/dns/builder.rs`**: The serialization engine for writing constructed DNS responses back into raw byte buffers.

## 🤝 Contributing

Contributions are heavily encouraged! If you're looking for things to hack on, consider:
- **Zero-Copy Parsing**: Refactoring `parser.rs` to use `&[u8]` slice references instead of `String` allocations to push throughput past the current memory-allocation ceiling.
- **TCP Support**: Implementing DNS over TCP for large responses.
- **DoH / DoT**: Adding support for DNS-over-HTTPS or DNS-over-TLS.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
