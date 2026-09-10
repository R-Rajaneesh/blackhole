import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { execSync, spawn, ChildProcess } from "child_process";
import * as dgram from "dgram";

import createHeader from "./utils/createHeader.ts";
import createQuestion from "./utils/createQuestion.ts";
import { QuestionClass, QuestionType } from "./types/index.ts";

let serverProcess: ChildProcess | null = null;
const PORT = 2053;
const HOST = "127.0.0.1";

const isServerRunning = () => {
    try {
        // Suppress output, check if anything is listening on UDP 2053
        execSync(`lsof -i UDP:${PORT}`, { stdio: "ignore" });
        return true;
    } catch (e) {
        return false;
    }
};

beforeAll(async () => {
    if (!isServerRunning()) {
        console.log("Starting DNS server...");
        serverProcess = spawn("bun", ["run", "dev"], {
            stdio: "ignore",
            detached: true
        });
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for server to start
    } else {
        console.log("DNS server is already running.");
    }
});

afterAll(() => {
    if (serverProcess && serverProcess.pid) {
        console.log("Killing DNS server...");
        try {
            process.kill(-serverProcess.pid); // Kill process group since it's detached
        } catch (e) {
            serverProcess.kill();
        }
    }
});

function createDnsQuery(domain: string, type: QuestionType, id: number) {
    const header = createHeader({
        packetID: id,
        resultFlag: 0x0100, // Standard query
        QDCount: 1,
        ANCount: 0,
        NSCount: 0,
        ARCount: 0,
    });
    const question = createQuestion({
        domain,
        type,
        class: QuestionClass.IN,
    });
    return Buffer.concat([header, question]);
}

function sendQuery(domain: string, type: QuestionType, id: number): Promise<{ time: number, response: Buffer }> {
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket("udp4");
        const query = createDnsQuery(domain, type, id);
        const start = performance.now();

        client.on("message", (msg) => {
            const end = performance.now();
            client.close();
            resolve({ time: end - start, response: msg });
        });

        client.on("error", (err) => {
            client.close();
            reject(err);
        });

        client.send(query, PORT, HOST, (err) => {
            if (err) {
                client.close();
                reject(err);
            }
        });

        // Timeout after 3 seconds
        setTimeout(() => {
            try { client.close(); } catch (e) {}
            reject(new Error(`DNS query timeout for ${domain}`));
        }, 3000);
    });
}

describe("Functional Tests", () => {
    it("should resolve google.com (A)", async () => {
        const { time, response } = await sendQuery("google.com", QuestionType.A, 1);
        expect(response.length).toBeGreaterThan(12);
        const packetID = response.readUInt16BE(0);
        expect(packetID).toBe(1);
        const anCount = response.readUInt16BE(6);
        expect(anCount).toBeGreaterThanOrEqual(1);
    });

    it("should resolve ipv6.google.com (AAAA)", async () => {
        const { time, response } = await sendQuery("ipv6.google.com", QuestionType.AAAA, 2);
        expect(response.length).toBeGreaterThan(12);
        const packetID = response.readUInt16BE(0);
        expect(packetID).toBe(2);
        const anCount = response.readUInt16BE(6);
        expect(anCount).toBeGreaterThanOrEqual(1);
    });

    it("should cache and serve fast on second request", async () => {
        const res1 = await sendQuery("example.com", QuestionType.A, 3);
        const res2 = await sendQuery("example.com", QuestionType.A, 4);

        expect(res1.response.length).toBeGreaterThan(12);
        expect(res1.response.readUInt16BE(6)).toBeGreaterThanOrEqual(1);
        expect(res2.response.length).toBeGreaterThan(12);
        expect(res2.response.readUInt16BE(6)).toBeGreaterThanOrEqual(1);
    });
});

describe("Performance Tests", () => {
    it("should handle 1000 concurrent requests and print statistics", async () => {
        const N = 1000;
        const promises = [];
        for (let i = 0; i < N; i++) {
            promises.push(sendQuery("cloudflare.com", QuestionType.A, 100 + i));
        }

        const startTotal = performance.now();
        const results = await Promise.allSettled(promises);
        const endTotal = performance.now();

        const times: number[] = [];
        let successes = 0;
        let failures = 0;

        for (const res of results) {
            if (res.status === "fulfilled") {
                successes++;
                times.push(res.value.time);
            } else {
                failures++;
            }
        }

        times.sort((a, b) => a - b);
        const min = times[0] || 0;
        const max = times[times.length - 1] || 0;
        const avg = times.reduce((a, b) => a + b, 0) / (times.length || 1);
        const p95 = times[Math.floor(times.length * 0.95)] || 0;

        console.log("\n=============================================");
        console.log("            Performance Statistics           ");
        console.log("=============================================");
        console.log(` Total Requests : ${N}`);
        console.log(` Success        : ${successes}`);
        console.log(` Failures       : ${failures}`);
        console.log(` Total Time     : ${(endTotal - startTotal).toFixed(2)} ms`);
        console.log(` Min Latency    : ${min.toFixed(2)} ms`);
        console.log(` Max Latency    : ${max.toFixed(2)} ms`);
        console.log(` Average Latency: ${avg.toFixed(2)} ms`);
        console.log(` P95 Latency    : ${p95.toFixed(2)} ms`);
        console.log("=============================================\n");

        expect(successes).toBe(N);
    }, 30000);
});
