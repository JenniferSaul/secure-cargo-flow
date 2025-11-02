import { JsonRpcProvider, Eip1193Provider } from 'ethers';

// Type definitions
declare global {
  interface Window {
    relayerSDK?: {
      initSDK: (options?: any) => Promise<boolean>;
      createInstance: (config: any) => Promise<any>;
      SepoliaConfig: any;
      __initialized__?: boolean;
    };
  }
}

export type FhevmInstance = any;

async function getChainId(providerOrUrl: Eip1193Provider | string): Promise<number> {
  if (typeof providerOrUrl === 'string') {
    const provider = new JsonRpcProvider(providerOrUrl);
    return Number((await provider.getNetwork()).chainId);
  }
  const chainId = await providerOrUrl.request({ method: 'eth_chainId' });
  return Number.parseInt(chainId as string, 16);
}

async function getWeb3Client(rpcUrl: string): Promise<string> {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send('web3_clientVersion', []);
    return version as string;
  } catch (e) {
    throw new Error(`The URL ${rpcUrl} is not a Web3 node or is not reachable.`);
  } finally {
    rpc.destroy();
  }
}

async function getFHEVMRelayerMetadata(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const metadata = await rpc.send('fhevm_relayer_metadata', []);
    return metadata;
  } catch (e) {
    throw new Error(`The URL ${rpcUrl} is not a FHEVM Hardhat node or is not reachable.`);
  } finally {
    rpc.destroy();
  }
}

async function tryFetchFHEVMHardhatNodeRelayerMetadata(
  rpcUrl: string
): Promise<
  | {
      ACLAddress: `0x${string}`;
      InputVerifierAddress: `0x${string}`;
      KMSVerifierAddress: `0x${string}`;
    }
  | undefined
> {
  try {
    const version = await getWeb3Client(rpcUrl);
    if (typeof version !== 'string' || !version.toLowerCase().includes('hardhat')) {
      return undefined;
    }

    const metadata = await getFHEVMRelayerMetadata(rpcUrl);
    if (!metadata || typeof metadata !== 'object') return undefined;

    if (
      !(
        'ACLAddress' in metadata &&
        typeof metadata.ACLAddress === 'string' &&
        metadata.ACLAddress.startsWith('0x')
      )
    ) {
      return undefined;
    }
    if (
      !(
        'InputVerifierAddress' in metadata &&
        typeof metadata.InputVerifierAddress === 'string' &&
        metadata.InputVerifierAddress.startsWith('0x')
      )
    ) {
      return undefined;
    }
    if (
      !(
        'KMSVerifierAddress' in metadata &&
        typeof metadata.KMSVerifierAddress === 'string' &&
        metadata.KMSVerifierAddress.startsWith('0x')
      )
    ) {
      return undefined;
    }

    return {
      ACLAddress: metadata.ACLAddress as `0x${string}`,
      InputVerifierAddress: metadata.InputVerifierAddress as `0x${string}`,
      KMSVerifierAddress: metadata.KMSVerifierAddress as `0x${string}`,
    };
  } catch {
    return undefined;
  }
}

type MockResolveResult = { isMock: true; chainId: number; rpcUrl: string };
type GenericResolveResult = { isMock: false; chainId: number; rpcUrl?: string };
type ResolveResult = MockResolveResult | GenericResolveResult;

async function resolve(
  providerOrUrl: Eip1193Provider | string,
  mockChains?: Record<number, string>
): Promise<ResolveResult> {
  const chainId = await getChainId(providerOrUrl);
  let rpcUrl = typeof providerOrUrl === 'string' ? providerOrUrl : undefined;

  const _mockChains: Record<number, string> = {
    31337: 'http://localhost:8545',
    ...(mockChains ?? {}),
  };

  if (chainId in _mockChains) {
    if (!rpcUrl) {
      rpcUrl = _mockChains[chainId];
    }
    return { isMock: true, chainId, rpcUrl };
  }

  return { isMock: false, chainId, rpcUrl };
}

function isFhevmWindowType(win: unknown): win is typeof window {
  if (typeof win === 'undefined' || win === null || typeof win !== 'object') {
    return false;
  }
  if (!('relayerSDK' in win)) {
    return false;
  }
  const sdk = (win as any).relayerSDK;
  return (
    typeof sdk === 'object' &&
    typeof sdk.initSDK === 'function' &&
    typeof sdk.createInstance === 'function' &&
    typeof sdk.SepoliaConfig === 'object'
  );
}

const isFhevmInitialized = (): boolean => {
  if (!isFhevmWindowType(window)) return false;
  return window.relayerSDK?.__initialized__ === true;
};

const fhevmLoadSDK = async (): Promise<void> => {
  // Wait for SDK to load from CDN
  let retries = 0;
  while (!isFhevmWindowType(window) && retries < 50) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    retries++;
  }

  if (!isFhevmWindowType(window)) {
    throw new Error('Failed to load FHEVM Relayer SDK from CDN');
  }
};

const fhevmInitSDK = async (options?: any): Promise<boolean> => {
  if (!isFhevmWindowType(window)) {
    throw new Error('window.relayerSDK is not available');
  }
  const result = await (window.relayerSDK as any).initSDK(options);
  (window.relayerSDK as any).__initialized__ = result;
  if (!result) {
    throw new Error('window.relayerSDK.initSDK failed.');
  }
  return true;
};

export const createFhevmInstance = async (parameters: {
  provider: Eip1193Provider | string;
  mockChains?: Record<number, string>;
}): Promise<FhevmInstance> => {
  const { provider: providerOrUrl, mockChains } = parameters;

  const { isMock, rpcUrl, chainId } = await resolve(providerOrUrl, mockChains);

  // If it's a local Hardhat network, try to use mock mode
  if (isMock && rpcUrl) {
    const fhevmRelayerMetadata = await tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl);

    if (fhevmRelayerMetadata) {
      console.log('Using FHEVM mock mode for local Hardhat node');
      // Dynamic import to avoid including mock utils in production bundle
      const { MockFhevmInstance } = await import('@fhevm/mock-utils');
      const provider = new JsonRpcProvider(rpcUrl);
      const mockInstance = await MockFhevmInstance.create(provider, provider, {
        aclContractAddress: fhevmRelayerMetadata.ACLAddress,
        chainId: chainId,
        gatewayChainId: 55815,
        inputVerifierContractAddress: fhevmRelayerMetadata.InputVerifierAddress,
        kmsContractAddress: fhevmRelayerMetadata.KMSVerifierAddress,
        verifyingContractAddressDecryption: '0x5ffdaAB0373E62E2ea2944776209aEf29E631A64',
        verifyingContractAddressInputVerification: '0x812b06e1CDCE800494b79fFE4f925A504a9A9810',
      });
      return mockInstance;
    }
  }

  // Use real relayer SDK for testnet/mainnet
  if (!isFhevmWindowType(window)) {
    await fhevmLoadSDK();
  }

  if (!isFhevmInitialized()) {
    await fhevmInitSDK();
  }

  const relayerSDK = window.relayerSDK;
  if (!relayerSDK) {
    throw new Error('relayerSDK is not available');
  }

  // Use appropriate config based on network
  const config = {
    ...(relayerSDK as any).SepoliaConfig,
    network: providerOrUrl,
  };

  const instance = await relayerSDK.createInstance(config);
  return instance;
};


