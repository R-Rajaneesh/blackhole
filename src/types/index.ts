export const NULL = 0x00;
export enum QuestionType {
	A = 0x01,
	NS = 0x02,
	MD = 0x03,
	MF = 0x04,
	CNAME = 0x05,
	SOA = 0x06,
	MB = 0x07,
	MG = 0x08,
	MR = 0x09,
	NULL = 0x0a,
	WKS = 0x0b,
	PTR = 0x0c,
	HINFO = 0x0d,
	MINFO = 0x0e,
	MX = 0x0f,
	TXT = 0x10,
	AAAA = 0x1c,
}
export enum QuestionClass {
	IN = 0x01,
	CS = 0x02,
	CH = 0x03,
	HS = 0x04,
}

export interface TCreateHeader {
	packetID: number;
	resultFlag: number;
	QDCount: number;
	NSCount: number;
	ANCount: number;
	ARCount: number;
}
export interface TCreateAnswer {
	type: QuestionType;
	class: QuestionClass;
	ttl: number;
	rdlen: number;
	offset: number;
	rddata: string;
}

export interface TFlagData {
    QR?: number;
    OPCode?: number;
    AA?: number;
    TC?: number;
    RD?: number;
    RA?: number;
    Z?: number;
    RCode?: number;
}
export interface TCreateQuestion {
	domain: string;
	type: QuestionType;
	class: QuestionClass;
}
