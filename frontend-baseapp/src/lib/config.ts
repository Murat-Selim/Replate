import { http, createConfig, createStorage, cookieStorage } from 'wagmi';
import { baseAccount, injected } from 'wagmi/connectors';
import { appChain } from "@/lib/network";

export const config = createConfig({
  chains: [appChain],
  connectors: [
    injected(),
    baseAccount({
      appName: 'Replate',
    }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [appChain.id]: http(),
  },
});
