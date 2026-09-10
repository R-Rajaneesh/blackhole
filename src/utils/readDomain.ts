const readDomain = (
	buf: Buffer,
	offset: number = 12,
	visited: Set<number> = new Set(),
): { parts: string[]; bytesRead: number } => {
	let currOffset = offset;
	let initialBytesRead = 0;
	let jumped = false;
	const parts: string[] = [];
	try {
		visited.add(offset);

		while (offset < buf.length) {
			let len = buf.readUInt8(currOffset);
			if (len === 0) {
				if (!jumped) initialBytesRead += 1;
				break;
			}
			if ((len & 0xc0) === 0xc0) {
				if (currOffset + 2 > buf.length) return { parts: [], bytesRead: 0 };
				let pos = buf.readUInt16BE(currOffset) & 0x3fff;
				if (visited.has(pos)) return { parts: [], bytesRead: 0 };
				visited.add(pos);
				if (!jumped) {
					initialBytesRead += 2;
					jumped = true;
				}
				const res = readDomain(buf, pos, visited);
				parts.push(...res.parts);
				break;
			} else {
				if (currOffset + len + 1 > buf.length) break;
				let domainLabel = buf.subarray(currOffset + 1, currOffset + len + 1).toString("ascii");
				parts.push(domainLabel);
				if (!jumped) initialBytesRead += len + 1;
				currOffset += len + 1;
			}
		}
		return { parts, bytesRead: initialBytesRead };
	} catch (error) {
		console.log(error);
		return { parts: [], bytesRead: 0 };
	}
};
export default readDomain;

