import readDomain from "./readDomain";
import readIPAddress from "./readIpAddress";

const readAnswer = (buf: Buffer, answerOffset: number = 18) => {
    let offset = answerOffset;
    const firstByte = buf.readUint8(offset);
    let nameBytesRead = 0;
    let domain: string = "";
    if ((firstByte & 0xc0) === 0xc0) {
        nameBytesRead = 2;
        const namePointerOffset = buf.readUInt16BE(offset) & 0x3fff;
        const { parts, bytesRead } = readDomain(buf, namePointerOffset);
        domain = parts.join(".");
    } else {
        const { parts, bytesRead } = readDomain(buf, offset);
        domain = parts.join(".");
        nameBytesRead = bytesRead;
    }
    offset += nameBytesRead;
    if (offset + 10 > buf.length) throw new Error("Buffer short to read Answer Fixed Header");
    const qType = buf.readUInt16BE(offset);
    offset += 2;
    const qClass = buf.readUInt16BE(offset);
    offset += 2;
    const ttl = buf.readUInt32BE(offset);
    offset += 4;
    const rdlen = buf.readUInt16BE(offset);
    offset += 2;
    const { domain: ADomainParts, bytesRead: rdBytesRead } = readIPAddress(buf, qType, rdlen, offset);
    offset += rdlen;

    return {
        domain: domain,
        type: qType,
        class: qClass,
        ttl,
        rdlen,
        rddata: ADomainParts,
        bytesRead: offset - answerOffset,
    };
};
export default readAnswer;
