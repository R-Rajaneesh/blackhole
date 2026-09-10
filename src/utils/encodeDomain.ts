const encodeDomain = (domain: string) => {
	const parts = domain.split(".");
	const buffers = parts.map((part) => {
		const len = Buffer.from([part.length]);
		const str = Buffer.from(part, "ascii");
		return Buffer.concat([len, str]);
	});
	return Buffer.concat([...buffers]);
};
export default encodeDomain
