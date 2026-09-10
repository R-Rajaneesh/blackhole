import type { TCreateHeader } from "../types";

const createHeader = ({ packetID, ANCount, ARCount, NSCount, QDCount, resultFlag }: TCreateHeader) => {
	const header = Buffer.alloc(12);

	header.writeUInt16BE(packetID, 0); // ID
	header.writeUInt16BE(resultFlag, 2); // Flags
	header.writeUInt16BE(QDCount, 4); // QDCOUNT
	header.writeUInt16BE(ANCount, 6); // ANCOUNT
	header.writeUInt16BE(NSCount, 8); // NSCOUNT
	header.writeUInt16BE(0, 10); // ARCOUNT

	return header;
};
export default createHeader
