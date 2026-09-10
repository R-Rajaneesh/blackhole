import { type TCreateHeader, QuestionClass, QuestionType, NULL, type TCreateAnswer } from "./types/index.ts";
import readAnswer from "./utils/readAnswer.ts";
import readBuffer from "./utils/readBuffer.ts";
import readDomain from "./utils/readDomain.ts";
import readIPAddress from "./utils/readIpAddress.ts";
import createAnswer from "./utils/createAnswer.ts";
import createFlag from "./utils/createFlag.ts";
import createQuestion from "./utils/createQuestion.ts";
import createHeader from "./utils/createHeader.ts";
import encodeDomain from "./utils/encodeDomain.ts";
import expandIPv6 from "./utils/expandIPv6.ts";
import parseQuestion from "./utils/parseQuestion.ts";
import resolveQuery from "./utils/resolveQuery.ts";
import CacheManager from "./services/CacheManager.ts";
// import type {} from "type-fest"
let resolverIP: string = "1.1.1.1:53";
for (let i = 0; i < process.argv.length; i++) {
	if (process.argv[i] === "--resolver") {
		resolverIP = process.argv[i + 1] as string;
		break;
	}
}

// const forwardedReq = new CacheManager<
// 	string,
// 	{ question: ReturnType<typeof parseQuestion>; address: string; port: number }
// >();
// const cacheReq = new CacheManager<
// 	{ domain: string; qType: QuestionType; qClass: QuestionClass },
// 	ReturnType<typeof createAnswer>
// >();

interface PendingClient {
	address: string;
	port: number;
	packetID: number;
}
const inFlightReq = new Map<string, { clients: PendingClient[], timestamp: number }>();
const pendingUpstreamIDs = new Map<number, { domainKey: string, timestamp: number }>();
const cacheReq = new CacheManager<string, Omit<ReturnType<typeof readAnswer>, "bytesRead" | "domain">>();
let nextInternalId = 0;

setInterval(() => {
	const now = Date.now();
	for (const [key, value] of inFlightReq.entries()) {
		if (now - value.timestamp > 3000) {
			inFlightReq.delete(key);
		}
	}
	for (const [key, value] of pendingUpstreamIDs.entries()) {
		if (now - value.timestamp > 3000) {
			pendingUpstreamIDs.delete(key);
		}
	}
}, 1000);

const soc = await Bun.udpSocket({
	hostname: "0.0.0.0",
	port: 2053,
	socket: {
		data: async (socket, data, port, address, flags) => {
			const [raddr, rport] = resolverIP.split(":") as [string, string];
			// console.log(cacheReq.entries());
			try {
				let questionReadOffset = 12;
				const BufferData = readBuffer(data);
				let QuestionLabel: ReturnType<typeof parseQuestion> = parseQuestion(BufferData.rawBuf, 12);
				if (raddr === address) {
					const upstreamData = pendingUpstreamIDs.get(BufferData.packetID);
					if (!upstreamData) return;
					const expectedDomainKey = upstreamData.domainKey;
					const actualDomainKey = `${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`;
					if (expectedDomainKey !== actualDomainKey) return;
					pendingUpstreamIDs.delete(BufferData.packetID);
					if (BufferData.ANCount === 0) {
						const waitingReq = inFlightReq.get(`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`);
						const waitingClients = waitingReq ? waitingReq.clients : [];
						inFlightReq.delete(`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`);
						for (const client of waitingClients) {
							let buf = Buffer.from(data);
							buf.writeUInt16BE(client.packetID, 0);
							soc.send(buf, client.port, client.address);
						}
						return;
					}
					const answer = readAnswer(data, QuestionLabel.totalBytesRead + 12);
					// console.log(BufferData, question, answer);
					cacheReq.set(
						`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`,
						answer,
						answer.ttl * 1000,
					);
					const waitingReq = inFlightReq.get(`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`);
					const waitingClients = waitingReq ? waitingReq.clients : [];
					const BATCH_SIZE = 500;
					let i = 0;
					const sendBatch = () => {
						const end = Math.min(i + BATCH_SIZE, waitingClients.length);
						for (; i < end; i++) {
							const client = waitingClients[i] as PendingClient;
							let buf = Buffer.from(data);
							buf.writeUInt16BE(client.packetID, 0);
							soc.send(buf, client.port, client.address);
						}

						// If there are still clients waiting, queue the next batch on the event loop
						if (i < waitingClients.length) {
							setImmediate(sendBatch);
						} else {
							// Clean up the queue only after all batches are sent
							inFlightReq.delete(`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`);
						}
					};

					// Start sending the first batch
					sendBatch();
					return;
				}
				if (inFlightReq.has(`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`)) {
					inFlightReq
						.get(`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`)!.clients
						.push({ address, packetID: BufferData.packetID, port });
					return;
				} else {
					inFlightReq.set(`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`, {
						clients: [{ packetID: BufferData.packetID, address, port }],
						timestamp: Date.now()
					});
				}
				// console.log(QuestionLabel, inFlightReq.entries());
				// questionReadOffset += QuestionLabel.totalBytesRead;
				// let resolvedIP =
				// 	(await resolveQuery({
				// 		domain: QuestionLabel.domain,
				// 		resolverDomain: resolverIP,
				// 	})) ?? "0.0.0.0";

				const cacheData = cacheReq.get(`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`);
				if (!cacheData) {
					let internalId = nextInternalId;
					while (pendingUpstreamIDs.has(internalId)) {
						internalId = (internalId + 1) & 0xFFFF;
						if (internalId === nextInternalId) break;
					}
					nextInternalId = (internalId + 1) & 0xFFFF;

					pendingUpstreamIDs.set(internalId, {
						domainKey: `${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`,
						timestamp: Date.now()
					});

					const forwardBuf = Buffer.from(data);
					forwardBuf.writeUInt16BE(internalId, 0);

					soc.send(forwardBuf, parseInt(rport), raddr);
					return;
				}
				const questions: Buffer<ArrayBuffer>[] = [];
				const answers: Buffer<ArrayBuffer>[] = [];
				const question = createQuestion(QuestionLabel);
				let resolvedIP = cacheData.rddata;
				let createAnswerOptions = {
					type: QuestionLabel.type,
					class: QuestionLabel.class,
					ttl: cacheData.ttl ?? 60,
					rdlen: QuestionLabel.type === QuestionType.A ? 4 : 16,
					rddata: resolvedIP,
					offset: questionReadOffset === 12 ? 0 : questionReadOffset,
				};
				const answer = createAnswer(createAnswerOptions);
				questions.push(question);
				answers.push(answer);
				// }

				const header = createHeader({
					packetID: BufferData.packetID,
					ANCount: answers.length,
					ARCount: BufferData.ARCount,
					NSCount: BufferData.NSCount,
					QDCount: BufferData.QDCount,
					resultFlag: BufferData.resultFlag,
				});
				cacheReq.set(
					`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`,
					{
						...createAnswerOptions,
						rddata: resolvedIP,
					},
					createAnswerOptions.ttl * 1000,
				);
				inFlightReq.delete(`${QuestionLabel.domain}:${QuestionLabel.class}:${QuestionLabel.type}`);
				const res = Buffer.concat([header, ...questions, ...answers]);
				socket.send(res, port, address);
			} catch (e) {
				console.log(`Error sending data: ${e}`);
			}
		},
	},
});

