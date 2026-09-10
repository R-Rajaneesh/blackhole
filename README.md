<div align="center">
  <h1>🕳️ Blackhole DNS (Test Tools)</h1>
  <p><strong>Benchmarking and diagnostic tools designed for the Blackhole DNS Proxy.</strong></p>

  <p>
    <a href="https://github.com/rust-lang/rust"><img src="https://img.shields.io/badge/Rust-1.80%2B-orange.svg" alt="Rust Version"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License"></a>
  </p>
</div>

---

**Blackhole (Test Tools)** contains the proprietary load testing suite and diagnostic tools used to develop, test, and profile the Blackhole DNS server.

## 🌿 Project Structure & Branches

This repository is organized into specialized branches for different components:

- **[`main`](https://github.com/R-Rajaneesh/blackhole/tree/main)**: The primary, production-grade high-performance DNS server written in **Rust**.
- **[`bun-dns-server`](https://github.com/R-Rajaneesh/blackhole/tree/bun-dns-server)**: The experimental initial implementation of this DNS server written in TypeScript using the Bun runtime.
- **[`test-tools`](https://github.com/R-Rajaneesh/blackhole/tree/test-tools)**: (You are here) Dedicated benchmarking and load-testing suites (`dns-bench`) used to validate the performance ceilings of Blackhole.

## 🚀 DNS Bench

`dns-bench` is a highly concurrent, multi-threaded UDP load generator specifically built to flood DNS servers and measure packet drop rates, average latency, and p99 tail latencies. 

### Prerequisites

You will need Rust and Cargo installed on your system.

### Building and Running

Clone the repository and run the benchmarking tool using Cargo. 

```bash
git clone https://github.com/R-Rajaneesh/blackhole.git
cd blackhole
git checkout test-tools
cd dns-bench

# Build and run the load tester in release mode
cargo run --release -- --server 127.0.0.1:2053 --workers 4 --qps 10000 --step 10000 --duration 5
```

### ⚠️ A Note on Port 53 Testing

If you are testing a DNS server running on port `53`, you specify it using `--server 127.0.0.1:53`. Unlike binding to port 53 to *listen* for queries, generating outbound requests to a server on port 53 **does not** require root or administrative privileges on Linux or Windows. 

However, if you are *running* the actual Blackhole DNS server on port 53 (on another terminal or server), that instance will require root/Administrator privileges.

**Linux (Server side):**
```bash
sudo target/release/blackhole --bind 0.0.0.0:53
```

**Windows (Server side):**
Run your terminal as **Administrator**.

## 🏗️ Architecture

- **`dns-bench/`**: The Rust-based high-throughput benchmarking client.
- **`dns-dashboard/`**: An experimental UI dashboard (React/Next.js) for visualizing DNS performance metrics in real-time.

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
Resolve-DnsName -Name google.com -Server 127.0.0.1 -Port 53
```
