use hdrhistogram::Histogram;

pub struct Metrics {
    pub sent: u64,
    pub received: u64,
    pub timeouts: u64,
    pub errors: u64,
    pub latencies: Histogram<u64>,
}

impl Metrics {
    pub fn new() -> Self {
        Self {
            sent: 0,
            received: 0,
            timeouts: 0,
            errors: 0,
            latencies: Histogram::<u64>::new_with_bounds(1, 10_000_000, 3).unwrap(),
        }
    }

    pub fn merge(&mut self, other: &Metrics) {
        self.sent += other.sent;
        self.received += other.received;
        self.timeouts += other.timeouts;
        self.errors += other.errors;
        self.latencies.add(&other.latencies).unwrap();
    }

    pub fn drop_rate(&self) -> f64 {
        if self.sent == 0 {
            return 0.0;
        }
        (self.sent.saturating_sub(self.received)) as f64 / self.sent as f64
    }
}
