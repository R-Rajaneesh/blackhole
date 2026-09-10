<div align="center">
  <h1>🕳️ Blackhole DNS (Bun Edition)</h1>
  <p><strong>An experimental, blazing fast DNS proxy written in TypeScript for the Bun runtime.</strong></p>

  <p>
    <a href="https://bun.sh"><img src="https://img.shields.io/badge/Powered%20by-Bun-black.svg" alt="Bun"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white" alt="TypeScript"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License"></a>
  </p>
</div>

---

**Blackhole (Bun Edition)** is the original experimental implementation of the Blackhole DNS proxy. It leverages the raw UDP socket performance of the [Bun](https://bun.sh) runtime to deliver low-latency DNS resolution and caching.

## 🌿 Project Structure & Branches

This repository is organized into specialized branches for different components:

- **[`main`](https://github.com/R-Rajaneesh/blackhole/tree/main)**: The primary, production-grade high-performance DNS server written in **Rust**.
- **[`bun-dns-server`](https://github.com/R-Rajaneesh/blackhole/tree/bun-dns-server)**: (You are here) The experimental initial implementation of this DNS server written in TypeScript using the Bun runtime.
- **[`test-tools`](https://github.com/R-Rajaneesh/blackhole/tree/test-tools)**: Dedicated benchmarking and load-testing suites (`dns-bench`) used to validate the performance ceilings of Blackhole.

## ✨ Features

- **⚡ Blazing Fast V8 Execution:** Leverages the Bun JavaScript runtime and its highly optimized UDP socket APIs.
- **🛡️ Fully Typed Protocol:** Implements a custom DNS protocol parser and builder entirely in TypeScript without external dependencies.
- **📉 In-Memory Caching:** Aggressively caches DNS queries (including NXDOMAIN) to reduce upstream latency and bandwidth.

## 🚀 Getting Started

### Prerequisites

You will need [Bun](https://bun.sh/) installed on your system.
```bash
curl -fsSL https://bun.sh/install | bash
```

### Building and Running

Clone the repository and install dependencies:

```bash
git clone https://github.com/R-Rajaneesh/blackhole.git
cd blackhole
git checkout bun-dns-server

# Install dependencies
bun install

# Run the server
bun run src/index.ts --resolver 1.1.1.1:53
```

### ⚠️ Running on Port 53 (Privileged Port)

Port 53 is the standard DNS port. By default, this Bun server listens on `0.0.0.0:2053` to avoid permission issues. If you modify `src/index.ts` to listen on port `53`, you will need to handle OS-specific privileges:

**Linux:**
You must run the server with `sudo`, or grant the `bun` binary capabilities (though running `sudo bun` is easier for development):
```bash
sudo bun run src/index.ts --resolver 1.1.1.1:53
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

- **`src/index.ts`**: The UDP entry point and asynchronous request router.
- **`src/utils/`**: Utility functions for binary parsing and manipulating raw DNS buffers.
- **`src/services/`**: The CacheManager that tracks TTLs and manages in-flight requests.

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

## 📊 Performance Benchmark (Rust vs Bun)

The Blackhole DNS server was load-tested using the `dns-bench` tool (available in the `test-tools` branch) at **10,000 Queries Per Second (QPS)**. The test utilized dynamic cache-busting queries (`{timestamp}.google.com`) to force 100% cache misses, aggressively stressing the upstream proxying throughput.

### 🥟 Bun Implementation (This Branch)

When subjected to the extreme throughput test, the Bun server successfully leverages transaction ID multiplexing to handle the massive load. It successfully proxies and fulfills ~34,000 queries in 5 seconds. The ~32% drop rate is entirely expected upstream behavior, as public resolvers (like 1.1.1.1) aggressively rate-limit 10,000 unique queries per second, mirroring the exact performance metrics of the Rust implementation.

```text
Targeting server: 127.0.0.1:2053
Workers: 4
Test duration per step: 5s
Randomize domain: true

Starting auto-scaling load test (max 1% packet drop)...
--------------------------------------------------
Testing at 10000 QPS...
Sent: 50000
Received: 33951
Drops/Timeouts: 16049 (32.10%)
Latency: Min: 15.58ms, Avg: 55.62ms, p95: 30.19ms, p99: 1.77s, Max: 3.18s
```
