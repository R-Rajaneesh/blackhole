import { QuestionType, QuestionClass, type TCreateAnswer } from "../types";
import expandIPv6 from "./expandIPv6";

const createAnswer = (options: TCreateAnswer) => {
	options.type ??= QuestionType.A;
	options.class ??= QuestionClass.IN;
	options.ttl ??= 60;
	options.rdlen ??= 4;
	options.offset ??= 0;
	let resolvedIP = options.rddata;
	console.log(options)
	const answer = Buffer.alloc(options.type === QuestionType.A ? 16 : 28);
	answer.writeUInt16BE((0xc000 + options?.offset) | 12, 0); // 0x000C pointer to the question QuestionLabel (Name)
	answer.writeUInt16BE(options?.type, 2); // Type
	answer.writeUInt16BE(options?.class, 4); // Class
	answer.writeUInt32BE(options?.ttl, 6); // TTL
	answer.writeUInt16BE(options?.rdlen, 10); // RDLength
	if (options?.type === QuestionType.A) {
		resolvedIP?.split(".").forEach((IPv4Byte, i) => {
			answer.writeUint8(parseInt(IPv4Byte), 12 + i);
		});
	} else if (options?.type == QuestionType.AAAA) {
		resolvedIP = expandIPv6(resolvedIP || "::1");
		let offset = 12;
		for (const block of resolvedIP?.split(":")) {
			answer.writeUint16BE(parseInt(block, 16), offset);
			offset += 2;
		}
	}
	return answer;
};
export default createAnswer;
