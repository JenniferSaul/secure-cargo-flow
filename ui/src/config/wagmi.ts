import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia, polygon, optimism, arbitrum, localhost } from 'wagmi/chains';
import { http } from 'wagmi';

// Custom Hardhat local chain to match your Hardhat node (chainId 31337)
const hardhat = {
  ...localhost,
  id: 31337,
  name: 'Hardhat Local',
  network: 'hardhat',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
};

// Additional testnets for broader compatibility
const sepoliaTestnet = {
  ...sepolia,
  rpcUrls: {
    default: {
      http: ['https://sepolia.infura.io/v3/YOUR_INFURA_KEY'],
    },
    public: {
      http: ['https://sepolia.infura.io/v3/YOUR_INFURA_KEY'],
    },
  },
};

export const appChains = [hardhat, sepoliaTestnet, polygon, optimism, arbitrum] as const;

// WalletConnect Project ID
const projectId = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

export const config = getDefaultConfig({
  appName: 'Secure Cargo Flow',
  projectId: projectId,
  chains: appChains,
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
    [sepoliaTestnet.id]: http('https://sepolia.infura.io/v3/YOUR_INFURA_KEY'),
    [polygon.id]: http('https://polygon-rpc.com'),
    [optimism.id]: http('https://mainnet.optimism.io'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
  },
  ssr: false,
});


