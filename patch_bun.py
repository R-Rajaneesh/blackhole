import re

with open("src/index.ts", "r") as f:
    content = f.read()

# Fix the response propagation for NXDOMAIN (0 answers)
old_block = """					pendingUpstreamIDs.delete(BufferData.packetID);
					const answer = readAnswer(data, QuestionLabel.totalBytesRead + 12);"""
new_block = """					pendingUpstreamIDs.delete(BufferData.packetID);
					if (BufferData.ANCount === 0) {
						const waitingClients = inFlightReq.get(`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`) || [];
						inFlightReq.delete(`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`);
						for (const client of waitingClients) {
							let buf = Buffer.from(data);
							buf.writeUInt16BE(client.packetID, 0);
							soc.send(buf, client.port, client.address);
						}
						return;
					}
					const answer = readAnswer(data, QuestionLabel.totalBytesRead + 12);"""

content = content.replace(old_block, new_block)

# Fast path for cache hit?
# Right now, cache hit does:
# const cacheData = cacheReq.get(...);
# if (!cacheData) { ... }
# const questions: Buffer<ArrayBuffer>[] = []; ...
# socket.send(res, port, address);
# This is already fully synchronous in Bun! So the fast-path is already there, it just doesn't use setImmediate for cache hits.

with open("src/index.ts", "w") as f:
    f.write(content)
