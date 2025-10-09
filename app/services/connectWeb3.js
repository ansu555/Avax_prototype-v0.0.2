// connectWeb3.ts
import { createConfig, http } from 'wagmi';
import { avalanche, avalancheFuji } from 'wagmi/chains';
import { getDefaultConfig } from 'connectkit';

export const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: '10xSwap',
  // Enable Avalanche mainnet and Avalanche Fuji (testnet) only
  chains: [avalanche, avalancheFuji],
    transports: {
      [avalanche.id]: http(),
      [avalancheFuji.id]: http(),
    },
    autoConnect: false,
    // walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  })
);
