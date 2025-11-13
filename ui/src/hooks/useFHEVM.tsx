import { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { createFhevmInstance } from '../fhevm/fhevmUtils';

interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export function useFHEVM() {
  const [instance, setInstance] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [keyPairs, setKeyPairs] = useState<Map<string, KeyPair>>(new Map());
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const initializeFHE = useCallback(async () => {
    if (!isConnected || !address || !chainId || !window.ethereum) {
      setError('Please connect your wallet first');
      return false;
    }

    try {
      setIsInitializing(true);
      setError(null);

      console.log('Initializing FHE SDK...', { chainId, address });

      // Create FHEVM instance (will auto-detect mock mode for localhost)
      const fheInstance = await createFhevmInstance({
        provider: window.ethereum,
        mockChains: {
          31337: 'http://localhost:8545',
        },
      });

      console.log('FHE instance created successfully:', !!fheInstance);
      
      setInstance(fheInstance);
      setIsInitialized(true);
      console.log('FHE initialized successfully');
      return true;
    } catch (err) {
      console.error('Failed to initialize FHE:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize FHE';

      // Retry logic for network issues
      if (retryCount < 2 && errorMessage.includes('network')) {
        console.log(`Retrying FHE initialization (${retryCount + 1}/2)...`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => initializeFHE(), 1000);
        return false;
      }

      setError(errorMessage);
      setRetryCount(0);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [isConnected, address, chainId]);

  useEffect(() => {
    if (isConnected && address && chainId && !instance && !isInitializing) {
      initializeFHE();
    }
    if (!isConnected && instance) {
      setInstance(null);
      setIsInitialized(false);
      setError(null);
    }
  }, [isConnected, address, chainId, instance, isInitializing, initializeFHE]);

  const createEncryptedInput = useCallback(
    (contractAddress: string, userAddress: string) => {
      if (!instance) {
        throw new Error('FHE instance not initialized');
      }
      return instance.createEncryptedInput(contractAddress, userAddress);
    },
    [instance]
  );

  const userDecrypt = useCallback(
    async (
      handleContractPairs: Array<{ handle: string; contractAddress: string }>,
      privateKey: string,
      publicKey: string,
      signature: string,
      contractAddresses: string[],
      userAddress: string,
      startTimestamp: string,
      durationDays: string
    ) => {
      if (!instance) {
        throw new Error('FHE instance not initialized');
      }
      return instance.userDecrypt(
        handleContractPairs,
        privateKey,
        publicKey,
        signature,
        contractAddresses,
        userAddress,
        startTimestamp,
        durationDays
      );
    },
    [instance]
  );

  const generateKeypair = useCallback(() => {
    if (!instance) {
      throw new Error('FHE instance not initialized');
    }
    return instance.generateKeypair();
  }, [instance]);

  const getOrCreateKeyPair = useCallback((contractAddress: string) => {
    const key = `${address}-${contractAddress}`;
    let keyPair = keyPairs.get(key);

    if (!keyPair) {
      keyPair = generateKeypair();
      setKeyPairs(prev => new Map(prev).set(key, keyPair!));
    }

    return keyPair;
  }, [address, keyPairs, generateKeypair]);

  const encryptBatch = useCallback(async (
    contractAddress: string,
    values: Array<{ type: 'uint32' | 'uint8', value: number }>
  ) => {
    if (!instance || !address) {
      throw new Error('FHE instance not initialized or wallet not connected');
    }

    const encryptedInput = instance.createEncryptedInput(contractAddress, address);

    for (const item of values) {
      if (item.type === 'uint32') {
        encryptedInput.add32(item.value);
      } else if (item.type === 'uint8') {
        encryptedInput.add8(item.value);
      }
    }

    return await encryptedInput.encrypt();
  }, [instance, address]);

  return {
    instance,
    isInitialized,
    isInitializing,
    error,
    initializeFHE,
    createEncryptedInput,
    userDecrypt,
    generateKeypair,
    getOrCreateKeyPair,
    encryptBatch,
    keyPairs,
  };
}

