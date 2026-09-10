import createFlag from "./createFlag";

const readBuffer = (buf: Buffer) => {
	const req = Buffer.from(buf);
	const packetID = req.readUint16BE(0);
	const flags = req.readUint16BE(2);
	const QDCount = req.readUint16BE(4);
	const ANCount = req.readUint16BE(6);
	const NSCount = req.readUint16BE(8);
	const ARCount = req.readUint16BE(10);
	let QR = (flags >> 15) & 1;
	let OPCode = (flags >> 11) & 0xf;
	let AA = (flags >> 10) & 1;
	let TC = (flags >> 9) & 1;
	let RD = (flags >> 8) & 1;
	let RA = (flags >> 7) & 1;
	let Z = (flags >> 4) & 0x7;
	let RCode = flags & 0xf;
	const resultFlag = createFlag({ QR, OPCode, RD, RCode: OPCode === 0 ? 0 : 4 });
	return {
		rawBuf: req,
		packetID,
		QDCount,
		ANCount,
		NSCount,
		ARCount,
		resultFlag,
		flag: { QR, OPCode, AA, TC, RD, RA, Z, RCode },
	};
};
export default readBuffer;
