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

## 🌿 Project Structure & Branches

This repository is organized into specialized branches for different components:

- **[`main`](https://github.com/R-Rajaneesh/blackhole/tree/main)**: (You are here) The primary, high-performance Rust DNS server.
- **[`bun-dns-server`](https://github.com/R-Rajaneesh/blackhole/tree/bun-dns-server)**: The experimental initial implementation of this DNS server written in TypeScript using the Bun runtime.
- **[`test-tools`](https://github.com/R-Rajaneesh/blackhole/tree/test-tools)**: Dedicated benchmarking and load-testing suites (`dns-bench`) used to validate the performance ceilings of Blackhole.

## ✨ Features

- **🚀 Synchronous Fast-Path Caching:** Cache hits are served instantly via a synchronous fast-path that entirely bypasses the async task scheduler, ensuring ultra-low latency.
- **🧵 Multi-Core Scaling:** Leverages `SO_REUSEPORT` via the `socket2` crate to spin up multiple lock-free UDP listeners across all your CPU cores.
- **⚡ Async Upstream Proxying:** Built on `tokio`, un-cached requests are resolved concurrently upstream without blocking the main event loops.
- **🔧 Configurable CLI:** Easily customize the listener address and upstream forwarder directly from the terminal via `clap`.

## 🚀 Getting Started

### Prerequisites

You will need Rust and Cargo installed on your system.
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Building and Running

Clone the repository and run the server using Cargo. 

```bash
git clone https://github.com/R-Rajaneesh/blackhole.git
cd blackhole

# Build and run the server in release mode
cargo run --release -- --bind 0.0.0.0:2053 --forwarder 1.1.1.1:53
```

### ⚠️ Running on Port 53 (Privileged Port)

Port 53 is the standard DNS port, but it is a "privileged" port (under 1024), meaning standard user accounts cannot bind to it by default. If you want to use `--bind 0.0.0.0:53`, follow these OS-specific instructions:

**Linux:**
You must run the server with `sudo`, or grant the binary `CAP_NET_BIND_SERVICE` capabilities:
```bash
# Option 1: Run with sudo
sudo target/release/blackhole --bind 0.0.0.0:53

# Option 2: Grant capabilities (no sudo required after this)
sudo setcap 'cap_net_bind_service=+ep' target/release/blackhole
./target/release/blackhole --bind 0.0.0.0:53
```
*(Note: You may also need to stop `systemd-resolved` which typically holds port 53 on modern Linux distributions: `sudo systemctl disable --now systemd-resolved`)*

**Windows:**
You must launch your terminal (PowerShell or Command Prompt) as an **Administrator** before running the server to bind to port 53.

### Testing the Server

You can query the server locally using `dig`:

```bash
dig @127.0.0.1 -p 2053 google.com
```

## 🏗️ Architecture

The codebase has been meticulously structured for modularity and ease of contribution:
- **`src/main.rs`**: The networking entry point. Manages the Tokio runtime, CLI parsing, and the `DashMap` cache.
- **`src/dns/models.rs`**: Contains all core DNS data structures.
- **`src/dns/parser.rs`**: The deserialization engine for parsing raw byte buffers from the wire.
- **`src/dns/builder.rs`**: The serialization engine for writing constructed DNS responses.

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License.

### Installing `dig`

`dig` is a powerful command-line tool for querying DNS name servers. Depending on your OS, you may need to install it:

**Debian/Ubuntu:**
```bash
sudo apt update
sudo apt install dnsutils
```

**Fedora/CentOS/RHEL:**
```bash
sudo dnf install bind-utils
```

**macOS:**
`dig` comes pre-installed on macOS!

**Windows:**
`dig` is not native to Windows. You can install it via [BIND](https://www.isc.org/download/) or use PowerShell's built-in equivalent:
```powershell
Resolve-DnsName -Name google.com -Server 127.0.0.1 -Port 2053
```
