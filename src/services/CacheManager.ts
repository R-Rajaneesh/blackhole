export default class CacheManager<K, V> {
	readonly #store = new Map<K, { value: V; expiresAt: number }>();
	readonly #sweepInterval: ReturnType<typeof setInterval>;

	constructor(sweepIntervalMs: number = 60000) {
		// Active GC to prevent O(n) memory leaks.
		this.#sweepInterval = setInterval(() => this.#sweep(), sweepIntervalMs);

		// Unref prevents the interval from blocking process exit in Bun/Node
		if (typeof this.#sweepInterval.unref === "function") {
			this.#sweepInterval.unref();
		}
	}

	public get(key: K): V | null {
		const data = this.#store.get(key);
		if (!data) return null;

		if (data.expiresAt <= Date.now()) {
			this.#store.delete(key);
			return null;
		}
		return data.value;
	}

	public set(key: K, value: V, ttlMs: number = 60000): this {
		this.#store.set(key, { value, expiresAt: Date.now() + ttlMs });
		return this;
	}

	public getOrInsert(key: K, defaultValue: V, ttlMs: number = 60000): V {
		const existing = this.get(key);
		if (existing !== null) return existing;

		this.set(key, defaultValue, ttlMs);
		return defaultValue;
	}

	public destroy(): void {
		clearInterval(this.#sweepInterval);
		this.#store.clear();
	}

	#sweep(): void {
		const now = Date.now();
		// V8/JavaScriptCore iteration over Map is highly optimized
		for (const [key, data] of this.#store.entries()) {
			if (data.expiresAt <= now) {
				this.#store.delete(key);
			}
		}
	}
}
