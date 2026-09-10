# Blackhole DNS

Blackhole is a high-performance DNS server written in Rust.

## Usage

```bash
cargo run --release -- --bind 0.0.0.0:2053 --forwarder 1.1.1.1:53
```

- `--bind`: The IP address and port to listen on (default: `0.0.0.0:2053`)
- `--forwarder`: The upstream DNS server to forward queries to (default: `1.1.1.1:53`)
