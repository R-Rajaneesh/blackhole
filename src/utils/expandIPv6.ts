const expandIPv6 = (ipv6: string): string => {
	if (ipv6.includes("::")) {
		const parts = ipv6.split("::");
		const leftParts = parts[0] ? parts[0].split(":") : [];
		const rightParts = parts[1] ? parts[1].split(":") : [];
		const missingLen = 8 - (leftParts?.length + rightParts?.length);
		const middle = Array(missingLen).fill("0");
		ipv6 = [...leftParts, ...middle, ...rightParts].join(":");
	}
	return ipv6;
};
export default expandIPv6;
