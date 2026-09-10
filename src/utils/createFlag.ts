import type { TFlagData } from "../types";

const createFlag = ({
    QR = 1,
    OPCode = 0,
    AA = 0,
    TC = 0,
    RD = 0,
    RA = 0,
    Z = 0,
    RCode = 0,
}: TFlagData) => {
    //	1	0000	0	0	0	0	000	0000
    //	QR	OPCODE	AA	TC	RD	RA	Z	RCODE
    let baseFlag = 0x8000; // 1000 0000 0000 0000
    let resultFlag = baseFlag;
    resultFlag |= QR << 15;
    resultFlag |= OPCode << 11;
    resultFlag |= AA << 10;
    resultFlag |= TC << 9;
    resultFlag |= RD << 8;
    resultFlag |= RA << 7;
    resultFlag |= Z << 4;
    resultFlag |= RCode << 0;
    return resultFlag;
};
export default createFlag;
