import { Resolver } from "dns/promises";

const resolveQuery = async ({
	domain,
	resolverDomain = "1.1.1.1:53",
}: {
	domain: string;
	resolverDomain: string;
}): Promise<string | null> => {
	const resolver = new Resolver();
	try {
		let addresses: string[];
		if (resolverDomain.matchAll(/\:/g).toArray().length > 1) {
			resolver.setServers([resolverDomain]);
			addresses = await resolver.resolve6(domain);
		} else {
			const [server, port] = resolverDomain.split(":");
			resolver.setServers([`${server}:${port}`]);
			addresses = await resolver.resolve4(domain);
		}
		return addresses.at(0) ?? null;
	} catch (error) {
		console.log(`Failed to resolve ${domain} on ${resolver.getServers().join(", ")}`);
		return null;
	}
};

export default resolveQuery;
