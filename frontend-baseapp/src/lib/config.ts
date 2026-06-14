import { http, createConfig, createStorage, cookieStorage } from 'wagmi';
import { baseAccount, injected } from 'wagmi/connectors';
import { appChain } from "@/lib/network";
import { Attribution } from 'ox/erc8021';

const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ['bc_7to91eav'],
});

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
  dataSuffix: DATA_SUFFIX,
});
