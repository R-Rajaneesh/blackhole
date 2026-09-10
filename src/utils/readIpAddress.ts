import { QuestionType } from "../types";

const readIPAddress = (buf: Buffer, qType: QuestionType, rdlen: number, offset: number) => {
	const parts: number[] = [];
	if (qType === QuestionType.AAAA && rdlen === 16) {
		for (let i = 0; i < 8; i++) {
			parts.push(buf.readUInt16BE(offset + i * 2));
		}
	} else {
		for (let i = 0; i < 4; i++) {
			parts.push(buf.readUInt8(offset + i));
		}
	}
	offset += rdlen;
	// while (offset < buf.length) {
	// 	parts.push(buf.readUInt8(offset));
	// 	offset += 2;
	// }
	return { domain: qType === QuestionType.A ? parts.join(".") : parts.join(":"), bytesRead: offset };
};
export default readIPAddress;

