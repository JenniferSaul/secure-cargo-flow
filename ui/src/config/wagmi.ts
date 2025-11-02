import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia, polygon, optimism, arbitrum, localhost } from 'wagmi/chains';
import { http } from 'wagmi';

// Custom Hardhat local chain to match your Hardhat node (chainId 31337)
const hardhat = {
  ...localhost,
  id: 31337,
  name: 'Hardhat',
  network: 'hardhat',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
};

export const appChains = [hardhat, mainnet, sepolia, polygon, optimism, arbitrum] as const;

// WalletConnect Project ID
const projectId = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

export const config = getDefaultConfig({
  appName: 'Secure Cargo Flow',
  projectId: projectId,
  chains: appChains,
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
  },
  ssr: false,
});


