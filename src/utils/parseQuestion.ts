import readDomain from "./readDomain";

const parseQuestion = (buf: Buffer, offset: number = 12) => {
	const { parts, bytesRead } = readDomain(buf, offset);
	const nextOffset = offset + bytesRead;
	if (nextOffset + 4 > buf.length) throw new Error("Buffer short to read Type and Class");
	const qType = buf.readUInt16BE(nextOffset);
	const qClass = buf.readUInt16BE(nextOffset + 2);
	return {
		domain: parts.join("."),
		type: qType,
		class: qClass,
		totalBytesRead: bytesRead + 4,
	};
};

export default parseQuestion;
