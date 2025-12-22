import { useAccount, useWriteContract, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { useFHEVM } from './useFHEVM';
import { SECURE_CARGO_FLOW_ABI, CONTRACT_ADDRESSES } from '@/config/contracts';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { waitForTransactionReceipt } from 'viem/actions';
import type { Address } from 'viem';

export function useSecureCargoFlow() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { isPending } = useWriteContract();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { instance, isInitialized, createEncryptedInput, generateKeypair, userDecrypt } = useFHEVM();

  const getContractAddress = useCallback(() => {
    if (chainId === 31337 || chainId === 1337) {
      return CONTRACT_ADDRESSES.localhost;
    }
    if (chainId === 11155111) {
      return CONTRACT_ADDRESSES.sepolia;
    }
    return CONTRACT_ADDRESSES.localhost;
  }, [chainId]);

  const createShipment = useCallback(
    async (
      trackingId: string,
      origin: string,
      destination: string,
      estimatedDelivery: number
    ) => {
      if (!isConnected || !address) {
        toast.error('Please connect your wallet');
        throw new Error('Wallet not connected');
      }

      if (!walletClient || !publicClient) {
        toast.error('Wallet client not ready');
        throw new Error('Wallet client not ready');
      }

      try {
        const contractAddress = getContractAddress();
        console.log('Creating shipment transaction...');
        
        const hash = await walletClient.writeContract({
          address: contractAddress as Address,
          abi: SECURE_CARGO_FLOW_ABI,
          functionName: 'createShipment',
          args: [trackingId, origin, destination, BigInt(estimatedDelivery)],
        });
        console.log('Transaction hash:', hash);
        
        toast.info('Waiting for transaction confirmation...');
        const receipt = await waitForTransactionReceipt(publicClient, { hash });
        console.log('Transaction confirmed:', receipt);
        
        if (receipt.status === 'success') {
          toast.success('Shipment created successfully');
        } else {
          toast.error('Transaction failed');
          throw new Error('Transaction failed');
        }
      } catch (error) {
        console.error('Create shipment failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to create shipment: ${errorMessage}`);
        throw error;
      }
    },
    [isConnected, address, walletClient, publicClient, getContractAddress]
  );

  const getEventCount = useCallback(
    async (trackingId: string): Promise<number> => {
      if (!publicClient) {
        return 0;
      }

      try {
        const contractAddress = getContractAddress();
        const count = await publicClient.readContract({
          address: contractAddress as Address,
          abi: SECURE_CARGO_FLOW_ABI,
          functionName: 'getEventCount',
          args: [trackingId],
        });
        return Number(count);
      } catch (error) {
        console.error('Get event count failed:', error);
        return 0;
      }
    },
    [publicClient, getContractAddress]
  );

  const addCargoEvent = useCallback(
    async (
      trackingId: string,
      location: string,
      status: number,
      weightInKg: number | null, // Not used in current contract, kept for compatibility
      contents: string // Used as description in the contract
    ) => {
      if (!isConnected || !address) {
        toast.error('Please connect wallet first');
        throw new Error('Wallet not connected');
      }

      try {
        const contractAddress = getContractAddress();
        console.log('Adding cargo event:', { trackingId, location, status, contents, contractAddress });

        if (!walletClient || !publicClient) {
          toast.error('Wallet client not ready');
          throw new Error('Wallet client not ready');
        }

        // Current contract uses simple string parameters
        // description field is used for contents
        const description = contents || `Weight: ${weightInKg ? weightInKg + ' kg' : 'N/A'}`;

        const hash = await walletClient.writeContract({
          address: contractAddress as Address,
          abi: SECURE_CARGO_FLOW_ABI,
          functionName: 'addCargoEvent',
          args: [
            trackingId,
            location,
            status,
            description,
          ],
        });
        
        console.log('Transaction hash:', hash);
        
        toast.info('Waiting for transaction confirmation...');
        const receipt = await waitForTransactionReceipt(publicClient, { hash });
        console.log('Transaction confirmed:', receipt);
        
        if (receipt.status === 'success') {
          toast.success('Cargo event added successfully');
          return hash;
        } else {
          toast.error('Transaction failed');
          throw new Error('Transaction failed');
        }
      } catch (error) {
        console.error('Add cargo event failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error details:', errorMessage);
        toast.error(`Failed to add cargo event: ${errorMessage}`);
        throw error;
      }
    },
    [isConnected, address, walletClient, publicClient, getContractAddress]
  );

  const decryptWeight = useCallback(
    async (trackingId: string, eventIndex: number): Promise<number | null> => {
      if (!isConnected || !address || !instance || !isInitialized || !walletClient || !publicClient) {
        toast.error('Please connect wallet and initialize FHE');
        return null;
      }

      try {
        const contractAddress = getContractAddress();
        
        if (!publicClient) {
          toast.error('Public client not available');
          return null;
        }
        
        // Read encrypted weight from contract
        console.log('Reading encrypted weight:', { trackingId, eventIndex, contractAddress });
        const encryptedWeight = await publicClient.readContract({
          address: contractAddress as Address,
          abi: SECURE_CARGO_FLOW_ABI,
          functionName: 'getEncryptedWeight',
          args: [trackingId, BigInt(eventIndex)],
        });

        console.log('Encrypted weight received:', encryptedWeight, 'type:', typeof encryptedWeight, 'length:', typeof encryptedWeight === 'string' ? encryptedWeight.length : 'N/A');

        // Ensure encryptedWeight is a string (hex format)
        // viem should return bytes32 as a hex string
        let encryptedWeightHex: string;
        const weightValue = encryptedWeight as unknown;
        if (typeof weightValue === 'string') {
          encryptedWeightHex = weightValue.startsWith('0x') ? weightValue : `0x${weightValue}`;
        } else if (typeof weightValue === 'bigint') {
          encryptedWeightHex = `0x${weightValue.toString(16).padStart(64, '0')}`;
        } else if (weightValue instanceof Uint8Array) {
          // Convert byte array to hex
          const bytes = Array.from(weightValue);
          encryptedWeightHex = `0x${bytes.map((b: number) => b.toString(16).padStart(2, '0')).join('')}`;
        } else if (Array.isArray(weightValue)) {
          // Convert array to hex
          encryptedWeightHex = `0x${weightValue.map((b: any) => Number(b).toString(16).padStart(2, '0')).join('')}`;
        } else {
          console.error('Unexpected encryptedWeight type:', typeof weightValue, weightValue);
          throw new Error(`Unexpected encryptedWeight type: ${typeof weightValue}`);
        }

        console.log('Encrypted weight hex:', encryptedWeightHex, 'length:', encryptedWeightHex.length, 'bytes:', (encryptedWeightHex.length - 2) / 2);

        if (!encryptedWeightHex || encryptedWeightHex === '0x0000000000000000000000000000000000000000000000000000000000000000' || encryptedWeightHex.length !== 66) {
          console.warn('Invalid encrypted weight:', encryptedWeightHex);
          return null;
        }

        // Generate keypair and signature for decryption
        const keypair = generateKeypair();
        const startTimestamp = Math.floor(Date.now() / 1000);
        const durationDays = 10;

        // Use FHEVM instance's createEIP712 to get correct EIP-712 format
        if (!instance) {
          throw new Error('FHE instance not initialized');
        }

        // Get contract addresses (sorted and unique as FHEVM expects)
        const contractAddresses = [contractAddress].sort();

        // Create EIP-712 format using FHEVM instance
        const eip712 = instance.createEIP712(
          keypair.publicKey,
          contractAddresses,
          startTimestamp,
          durationDays
        );

        console.log('EIP-712 format:', eip712);

        // Sign using the EIP-712 format from FHEVM
        const signature = await walletClient.signTypedData({
          domain: eip712.domain,
          types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
          primaryType: 'UserDecryptRequestVerification',
          message: eip712.message,
        });

        console.log('Signature created:', signature);

        // Decrypt
        console.log('Decrypting weight:', { 
          handle: encryptedWeightHex, 
          contractAddress, 
          address,
          handleLength: encryptedWeightHex.length 
        });
        
        // Note: userDecrypt expects signature without 0x prefix, and timestamp/duration as strings or numbers
        const result = await userDecrypt(
          [{ handle: encryptedWeightHex, contractAddress }],
          keypair.privateKey,
          keypair.publicKey,
          signature.replace('0x', ''), // Remove 0x prefix as FHEVM expects
          contractAddresses, // Use sorted contract addresses
          address,
          startTimestamp.toString(),
          durationDays.toString()
        );

        console.log('Decryption result:', result);
        const decryptedValue = result[encryptedWeightHex];
        if (typeof decryptedValue === 'bigint') {
          return Number(decryptedValue) / 1000; // Convert grams to kg
        }
        return null;
      } catch (error) {
        console.error('Decrypt weight failed:', error);
        toast.error('Failed to decrypt weight');
        return null;
      }
    },
    [isConnected, address, instance, isInitialized, walletClient, publicClient, generateKeypair, userDecrypt, getContractAddress, chainId]
  );

  const decryptContents = useCallback(
    async (trackingId: string, eventIndex: number): Promise<string | null> => {
      if (!isConnected || !address || !instance || !isInitialized || !walletClient || !publicClient) {
        toast.error('Please connect wallet and initialize FHE');
        return null;
      }

      try {
        const contractAddress = getContractAddress();
        
        if (!publicClient || !walletClient) {
          toast.error('Public client or wallet client not available');
          return null;
        }
        
        // Get contents length first
        console.log('Getting contents length:', { trackingId, eventIndex, contractAddress });
        const contentsLength = await publicClient.readContract({
          address: contractAddress as Address,
          abi: SECURE_CARGO_FLOW_ABI,
          functionName: 'getContentsLength',
          args: [trackingId, BigInt(eventIndex)],
        });

        const length = Number(contentsLength);
        console.log('Contents length:', length);

        if (length === 0) {
          return '';
        }

        // OPTIMIZATION: Batch fetch all encrypted bytes first
        console.log('Batch fetching all encrypted bytes...');
        const handles: string[] = [];
        for (let i = 0; i < length; i++) {
          // Get encrypted byte from contract
          const encByte = await publicClient.readContract({
            address: contractAddress as Address,
            abi: SECURE_CARGO_FLOW_ABI,
            functionName: 'getEncryptedContentsByte',
            args: [trackingId, BigInt(eventIndex), BigInt(i)],
          });

          // Convert to hex string format
          let encByteHex: string;
          const byteValue = encByte as unknown;
          if (typeof byteValue === 'string') {
            encByteHex = byteValue.startsWith('0x') ? byteValue : `0x${byteValue}`;
          } else if (typeof byteValue === 'bigint') {
            encByteHex = `0x${byteValue.toString(16).padStart(64, '0')}`;
          } else {
            console.error('Unexpected encrypted byte type:', typeof byteValue, byteValue);
            continue;
          }
          handles.push(encByteHex);
        }

        console.log(`Fetched ${handles.length} encrypted bytes, now batch decrypting...`);

        // OPTIMIZATION: Batch decrypt all bytes at once (only one keypair and signature needed)
        const keypair = generateKeypair();
        const startTimestamp = Math.floor(Date.now() / 1000);
        const durationDays = 10;
        const contractAddresses = [contractAddress].sort();

        // Create EIP-712 format (only once)
        const eip712 = instance.createEIP712(
          keypair.publicKey,
          contractAddresses,
          startTimestamp,
          durationDays
        );

        // Sign once (only once)
        const signature = await walletClient.signTypedData({
          domain: eip712.domain,
          types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
          primaryType: 'UserDecryptRequestVerification',
          message: eip712.message,
        });

        // Batch decrypt all handles at once
        const handleContractPairs = handles.map(handle => ({
          handle,
          contractAddress
        }));

        const decryptResult = await userDecrypt(
          handleContractPairs,
          keypair.privateKey,
          keypair.publicKey,
          signature.replace('0x', ''),
          contractAddresses,
          address,
          startTimestamp.toString(),
          durationDays.toString()
        );

        // Extract decrypted values
        const decryptedBytes: number[] = handles.map(handle => {
          const decryptedValue = decryptResult[handle];
          if (decryptedValue !== undefined && decryptedValue !== null) {
            return typeof decryptedValue === 'bigint' ? Number(decryptedValue) : Number(decryptedValue);
          } else {
            console.warn(`Failed to decrypt byte handle: ${handle}`);
            return 0;
          }
        });

        // Decode bytes to string
        if (decryptedBytes.length === 0) {
          return '';
        }

        // Remove trailing null bytes
        let endIndex = decryptedBytes.length;
        while (endIndex > 0 && decryptedBytes[endIndex - 1] === 0) {
          endIndex--;
        }

        if (endIndex === 0) {
          return '';
        }

        const decoded = new TextDecoder().decode(Uint8Array.from(decryptedBytes.slice(0, endIndex)));
        console.log('Decrypted contents:', decoded);
        return decoded;
      } catch (error) {
        console.error('Decrypt contents failed:', error);
        toast.error('Failed to decrypt contents');
        return null;
      }
    },
    [isConnected, address, instance, isInitialized, walletClient, publicClient, generateKeypair, userDecrypt, getContractAddress]
  );

  const getShipment = useCallback(
    async (trackingId: string) => {
      if (!publicClient) {
        return null;
      }

      try {
        const contractAddress = getContractAddress();
        const shipment = await publicClient.readContract({
          address: contractAddress as Address,
          abi: SECURE_CARGO_FLOW_ABI,
          functionName: 'getShipment',
          args: [trackingId],
        });
        return shipment;
      } catch (error) {
        console.error('Get shipment failed:', error);
        return null;
      }
    },
    [publicClient, getContractAddress]
  );

  const getCargoEvent = useCallback(
    async (trackingId: string, eventIndex: number) => {
      if (!publicClient) {
        return null;
      }

      try {
        const contractAddress = getContractAddress();
        const event = await publicClient.readContract({
          address: contractAddress as Address,
          abi: SECURE_CARGO_FLOW_ABI,
          functionName: 'getCargoEvent',
          args: [trackingId, BigInt(eventIndex)],
        });
        return event;
      } catch (error) {
        console.error('Get cargo event failed:', error);
        return null;
      }
    },
    [publicClient, getContractAddress]
  );

  const loadCargoEvents = useCallback(
    async (trackingId: string) => {
      if (!publicClient) {
        console.warn("Public client not available for loading events");
        return [];
      }

      try {
        const contractAddress = getContractAddress();
        console.log("Loading events for trackingId:", trackingId, "contract:", contractAddress);
        
        // Get event count
        const count = await publicClient.readContract({
          address: contractAddress as Address,
          abi: SECURE_CARGO_FLOW_ABI,
          functionName: 'getEventCount',
          args: [trackingId],
        });
        
        const eventCount = Number(count);
        console.log("Event count from contract:", eventCount);
        const events = [];

        // Load each event
        for (let i = 0; i < eventCount; i++) {
          try {
            console.log(`Loading event ${i}/${eventCount - 1}...`);
            const event = await publicClient.readContract({
              address: contractAddress as Address,
              abi: SECURE_CARGO_FLOW_ABI,
              functionName: 'getCargoEvent',
              args: [trackingId, BigInt(i)],
            });
            
            console.log(`Event ${i} data:`, event);
            
            if (event) {
              events.push({
                eventId: event[0].toString(),
                timestamp: Number(event[1]),
                location: event[2],
                status: Number(event[3]),
                contents: event[4], // description is now stored as contents
                isEncrypted: false, // Current contract doesn't use encryption
              });
            }
          } catch (eventError) {
            console.error(`Failed to load event ${i}:`, eventError);
            // Continue loading other events even if one fails
          }
        }

        console.log("Total events loaded:", events.length);
        return events;
      } catch (error) {
        console.error('Load cargo events failed:', error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error('Error details:', errorMessage);
        return [];
      }
    },
    [publicClient, getContractAddress]
  );

  return {
    createShipment,
    addCargoEvent,
    decryptWeight,
    decryptContents,
    getShipment,
    getEventCount,
    getCargoEvent,
    loadCargoEvents,
    isPending,
    contractAddress: getContractAddress(),
  };
}

