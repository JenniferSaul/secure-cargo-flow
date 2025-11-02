import { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { createFhevmInstance } from '../fhevm/fhevmUtils';

export function useFHEVM() {
  const [instance, setInstance] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
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
      setError(err instanceof Error ? err.message : 'Failed to initialize FHE');
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

  return {
    instance,
    isInitialized,
    isInitializing,
    error,
    initializeFHE,
    createEncryptedInput,
    userDecrypt,
    generateKeypair,
  };
}

