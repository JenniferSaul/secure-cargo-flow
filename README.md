# Secure Cargo Flow

Enterprise-grade cargo tracking system with end-to-end encryption using Fully Homomorphic Encryption (FHE) on blockchain.

## 🚀 Live Demo

**Vercel Deployment**: [https://secure-cargo-flow.vercel.app/](https://secure-cargo-flow-pro.vercel.app/)

## 📹 Demo Video

Watch the demo video to see Secure Cargo Flow in action:
- [Demo Video](https://youtu.be/rlQAu_QOCMc) (in repository)
- The video demonstrates the complete workflow: creating shipments, adding cargo events with encrypted data, and decrypting sensitive information

## Overview

Secure Cargo Flow is a blockchain-based logistics tracking system that enables secure, encrypted tracking of cargo shipments. Sensitive data such as weight and contents are encrypted using FHEVM, allowing only authorized parties to decrypt and view sensitive information.

## Features

- **End-to-End Encryption**: Sensitive cargo data (weight, contents) encrypted using FHE
- **Blockchain Verification**: All shipment data stored on-chain with immutable records
- **Selective Data Disclosure**: Only authorized users can decrypt sensitive information
- **Real-time Tracking**: Track shipments through multiple stages (Created, In Transit, Customs, Arrived)
- **Anomaly Detection**: Detect and report anomalies (temperature spikes, weight discrepancies)
- **Multi-chain Support**: Deploy on Ethereum, Sepolia, Polygon, Optimism, Arbitrum

## Technology Stack

### Smart Contracts
- **Solidity** ^0.8.27
- **FHEVM** for encrypted operations
- **Hardhat** for development and testing

### Frontend
- **React** 18.3.1
- **TypeScript** 5.8.3
- **Vite** 5.4.19
- **Wagmi** + **RainbowKit** for wallet connection
- **FHEVM Relayer SDK** for encryption/decryption
- **shadcn-ui** + **Tailwind CSS** for UI

## Project Structure

```
secure-cargo-flow/
├── contracts/
│   └── SecureCargoFlow.sol      # Main smart contract
├── deploy/
│   └── deploy.ts                 # Deployment script
├── test/
│   ├── SecureCargoFlow.ts       # Local tests
│   └── SecureCargoFlowSepolia.ts # Sepolia tests
├── tasks/
│   ├── accounts.ts              # Account management
│   └── SecureCargoFlow.ts       # Contract interaction tasks
├── ui/
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── hooks/               # Custom hooks (FHEVM, contracts)
│   │   ├── config/              # Wagmi and contract configs
│   │   └── main.tsx             # App entry point
│   └── public/                  # Static assets (logo, favicon)
├── hardhat.config.ts
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 7.0.0
- Hardhat node (for local development)

### Installation

1. **Install dependencies:**

```bash
npm install
cd ui && npm install
```

2. **Set up environment variables:**

Create a `.env` file in the root directory:

```env
MNEMONIC=your mnemonic phrase
INFURA_API_KEY=your infura api key
ETHERSCAN_API_KEY=your etherscan api key (optional)
```

Create a `.env` file in the `ui/` directory for frontend:

```env
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

Get your WalletConnect Project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/).

3. **Compile contracts:**

```bash
npm run compile
```

### Local Development

1. **Start Hardhat node:**

```bash
npm run node
```

2. **Deploy contracts (in another terminal):**

```bash
npm run deploy:local
```

3. **Run tests:**

```bash
npm run test:local
```

4. **Start frontend:**

```bash
cd ui
npm run dev
```

### Contract Interaction

Use Hardhat tasks to interact with the contract:

```bash
# Create a shipment
npx hardhat --network localhost task:create-shipment \
  --trackingId CARGO-001 \
  --origin "Shanghai Port" \
  --destination "Los Angeles Port"

# Add a cargo event
npx hardhat --network localhost task:add-event \
  --trackingId CARGO-001 \
  --location "Shanghai Port, China" \
  --weight 2500

# Decrypt weight
npx hardhat --network localhost task:decrypt-weight \
  --trackingId CARGO-001 \
  --eventIndex 0
```

## Smart Contract

### SecureCargoFlow.sol

The main smart contract implements a fully homomorphic encryption (FHE) based cargo tracking system. It stores encrypted sensitive data (weight and contents) on-chain while keeping public data (location, status) transparent.

**Contract Location**: [`contracts/SecureCargoFlow.sol`](./contracts/SecureCargoFlow.sol)

#### Key Data Structures

```solidity
struct Shipment {
    string trackingId;
    string origin;
    string destination;
    uint256 createdAt;
    uint256 estimatedDelivery;
    address creator;
    bool exists;
}

struct CargoEvent {
    uint256 eventId;
    string trackingId;
    uint256 timestamp;
    string location;
    ShipmentStatus status;
    euint32 encryptedWeight;        // Encrypted weight in grams
    euint8[] encContentsBytes;      // Encrypted contents (byte-by-byte)
    bool hasAnomaly;
    string anomalyDescription;
}
```

#### Key Functions

**Shipment Management:**
- `createShipment(trackingId, origin, destination, estimatedDeliveryTimestamp)`: Create a new shipment with public metadata
- `getShipment(trackingId)`: Retrieve shipment details (public data only)

**Cargo Event Management:**
- `addCargoEvent(trackingId, location, status, encryptedWeight, weightInputProof, encContentsBytes, inputProof)`: Add a cargo event with encrypted weight and contents
- `addCargoEventWithAnomaly(...)`: Add event with anomaly detection flag
- `getCargoEventPublic(trackingId, eventIndex)`: Get public event data (location, status, timestamp)

**Encrypted Data Access:**
- `getEncryptedWeight(trackingId, eventIndex)`: Retrieve encrypted weight handle for decryption
- `getContentsLength(trackingId, eventIndex)`: Get the number of encrypted content bytes
- `getEncryptedContentsByte(trackingId, eventIndex, byteIndex)`: Get a single encrypted byte from contents

#### Encryption Architecture

1. **Weight Encryption**: Weight is encrypted as `euint32` (32-bit encrypted unsigned integer) in grams
2. **Contents Encryption**: Contents string is encrypted byte-by-byte as an array of `euint8` values
3. **Shared Proof**: Weight and contents bytes are encrypted together using a single `inputProof` for efficiency
4. **ACL (Access Control List)**: The contract uses FHEVM's ACL system to control who can decrypt data
   - `FHE.allowThis()`: Allows the contract to use encrypted data
   - `FHE.allow(encryptedData, userAddress)`: Grants decryption permission to a specific user

#### Security Features

- **Immutable Records**: All events are stored on-chain with timestamps
- **Selective Disclosure**: Only authorized users (via wallet connection) can decrypt sensitive data
- **Weight Reuse**: Subsequent events reuse the first event's encrypted weight (no need to re-encrypt)
- **Anomaly Tracking**: Events can be marked with anomaly flags and descriptions

## Encryption & Decryption Logic

### Frontend Encryption Flow

The frontend uses the **FHEVM Relayer SDK** to encrypt sensitive data before sending it to the contract.

#### 1. Weight Encryption

```typescript
// Convert weight from kg to grams
const weightInGrams = Math.floor(weightInKg * 1000);

// Create encrypted input
const combinedInput = createEncryptedInput(contractAddress, userAddress);

// Add weight as 32-bit value
combinedInput.add32(weightInGrams);

// Encrypt (returns handle and proof)
const encrypted = await combinedInput.encrypt();
const encryptedWeightHandle = encrypted.handles[0];
const inputProof = encrypted.inputProof;
```

#### 2. Contents Encryption

Contents are encrypted byte-by-byte to support variable-length strings:

```typescript
// Convert string to bytes (max 64 bytes)
const contentsBytes = new TextEncoder().encode(contents.slice(0, 64));

// Add each byte to the same encrypted input (shares proof with weight)
for (const byte of contentsBytes) {
  combinedInput.add8(byte); // Encrypt as euint8
}

// Encrypt all together (weight + all content bytes share the same proof)
const combinedEncrypted = await combinedInput.encrypt();

// Extract handles: handles[0] = weight, handles[1..N] = content bytes
const encryptedWeightHandle = combinedEncrypted.handles[0];
const contentsByteHandles = combinedEncrypted.handles.slice(1);
const sharedProof = combinedEncrypted.inputProof; // Same proof for all
```

**Key Points:**
- Weight and contents are encrypted together in a single operation
- This ensures they share the same `inputProof`, reducing gas costs
- Each content byte is encrypted as `euint8` (8-bit encrypted integer)
- Maximum content length is 64 bytes (can be extended)

#### 3. Contract Interaction

```typescript
// Call contract with encrypted data
await walletClient.writeContract({
  address: contractAddress,
  abi: SECURE_CARGO_FLOW_ABI,
  functionName: 'addCargoEvent',
  args: [
    trackingId,
    location,
    status,
    encryptedWeightHandle,    // externalEuint32
    sharedProof,              // Same proof for weight
    contentsByteHandles,      // externalEuint8[]
    sharedProof               // Same proof for contents
  ],
});
```

### Frontend Decryption Flow

Decryption requires wallet connection and FHEVM instance initialization.

#### 1. Weight Decryption

```typescript
// Step 1: Read encrypted weight handle from contract
const encryptedWeight = await publicClient.readContract({
  address: contractAddress,
  abi: SECURE_CARGO_FLOW_ABI,
  functionName: 'getEncryptedWeight',
  args: [trackingId, eventIndex],
});

// Step 2: Generate keypair for decryption
const keypair = generateKeypair();

// Step 3: Create EIP-712 signature for decryption request
const eip712 = instance.createEIP712(
  keypair.publicKey,
  [contractAddress],
  startTimestamp,
  durationDays
);

// Step 4: Sign the decryption request
const signature = await walletClient.signTypedData({
  domain: eip712.domain,
  types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
  primaryType: 'UserDecryptRequestVerification',
  message: eip712.message,
});

// Step 5: Decrypt using FHEVM Relayer
const result = await userDecrypt(
  [{ handle: encryptedWeightHex, contractAddress }],
  keypair.privateKey,
  keypair.publicKey,
  signature,
  [contractAddress],
  userAddress,
  startTimestamp.toString(),
  durationDays.toString()
);

// Step 6: Convert decrypted value (grams) to kg
const weightInKg = Number(result[encryptedWeightHex]) / 1000;
```

#### 2. Contents Decryption

Contents decryption follows a similar pattern but handles multiple encrypted bytes:

```typescript
// Step 1: Get contents length
const length = await publicClient.readContract({
  functionName: 'getContentsLength',
  args: [trackingId, eventIndex],
});

// Step 2: Batch fetch all encrypted bytes
const handles: string[] = [];
for (let i = 0; i < length; i++) {
  const encryptedByte = await publicClient.readContract({
    functionName: 'getEncryptedContentsByte',
    args: [trackingId, eventIndex, i],
  });
  handles.push(encryptedByte);
}

// Step 3: Generate keypair and signature (same as weight decryption)
const keypair = generateKeypair();
// ... create EIP-712 and sign ...

// Step 4: Batch decrypt all bytes at once
const handleContractPairs = handles.map(handle => ({
  handle,
  contractAddress
}));

const decryptResult = await userDecrypt(
  handleContractPairs,
  keypair.privateKey,
  keypair.publicKey,
  signature,
  [contractAddress],
  userAddress,
  startTimestamp.toString(),
  durationDays.toString()
);

// Step 5: Extract decrypted bytes and decode to string
const decryptedBytes = handles.map(handle => 
  Number(decryptResult[handle])
);
const contents = new TextDecoder().decode(
  Uint8Array.from(decryptedBytes)
);
```

**Key Points:**
- Decryption requires wallet connection (for EIP-712 signature)
- FHEVM Relayer handles the actual decryption off-chain
- Batch decryption is used for contents to minimize API calls
- Decryption permissions are controlled by the contract's ACL system

### FHEVM Integration

The project uses **FHEVM Relayer SDK** loaded from CDN:

```html
<!-- Loaded in index.html -->
<script src="https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs"></script>
```

**Local Development:**
- For Hardhat local network (chainId 31337), the project uses `@fhevm/mock-utils` for testing
- Mock mode automatically detects Hardhat node and uses local FHEVM contracts

**Testnet/Mainnet:**
- Uses real FHEVM Relayer SDK with Sepolia configuration
- Requires proper network configuration in `wagmi.ts`

## Frontend Usage

1. **Connect Wallet**: Click "Connect Wallet" in the top right
   - Supports MetaMask, WalletConnect, Coinbase Wallet, and more via RainbowKit
2. **Create Shipment**: Fill in shipment details
   - Tracking ID, origin, destination, estimated delivery date
   - Weight and contents will be encrypted automatically
3. **Add Cargo Events**: Track shipment progress
   - Location, status (Created, In Transit, Customs, Arrived)
   - Weight (only required for first event, subsequent events reuse it)
   - Contents (encrypted byte-by-byte)
4. **View Timeline**: See all cargo events with public data
5. **Decrypt Data**: Click "🔒 Locked" button to decrypt sensitive data
   - Requires wallet connection
   - Weight and contents are decrypted on-demand
   - Decryption uses EIP-712 signature for authorization

## Testing

### Local Tests

```bash
npm run test:local
```

Tests cover:
- Shipment creation
- Adding cargo events with encrypted weight
- Weight decryption
- Anomaly detection
- Error handling

### Sepolia Tests

1. Deploy to Sepolia:
```bash
npm run deploy:sepolia
```

2. Run tests:
```bash
npm run test:sepolia
```

## Deployment

### Frontend Deployment (Vercel)

The project is configured for Vercel deployment with `vercel.json`:

```json
{
  "buildCommand": "cd ui && npm install && npm run build",
  "outputDirectory": "ui/dist",
  "framework": "vite"
}
```

**Deployment Steps:**

1. **Connect Repository to Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Import your GitHub repository
   - Vercel will auto-detect the configuration

2. **Configure Environment Variables:**
   - Add `VITE_WALLETCONNECT_PROJECT_ID` in Vercel project settings
   - Get your project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/)

3. **Deploy:**
   - Vercel will automatically deploy on push to main branch
   - Or manually trigger deployment from the dashboard

**Live Deployment:** [https://secure-cargo-flow.vercel.app/](https://secure-cargo-flow.vercel.app/)

### Smart Contract Deployment

#### Local Network

```bash
# Start Hardhat node
npm run node

# In another terminal, deploy contracts
npm run deploy:local
```

After deployment, update contract address in `ui/src/config/contracts.ts`:
```typescript
export const CONTRACT_ADDRESSES = {
  localhost: '0x...', // Update with deployed address
  // ...
};
```

#### Sepolia Testnet

1. **Set up environment variables:**
   ```env
   MNEMONIC=your mnemonic phrase
   INFURA_API_KEY=your infura api key
   ETHERSCAN_API_KEY=your etherscan api key (optional)
   ```

2. **Deploy:**
   ```bash
   npm run deploy:sepolia
   ```

3. **Update contract address:**
   ```typescript
   export const CONTRACT_ADDRESSES = {
     sepolia: '0x...', // Update with deployed address
     // ...
   };
   ```

**Note:** FHEVM contracts are automatically deployed by the FHEVM network. Your contract only needs to import the correct config (`SepoliaConfig` for Sepolia testnet).

## Security Considerations

- **End-to-End Encryption**: All sensitive data (weight, contents) is encrypted using FHEVM before being sent to the blockchain
- **Selective Disclosure**: Only authorized users (with wallet connection and proper signature) can decrypt sensitive information
- **ACL System**: Contract uses FHEVM's Access Control List (ACL) to manage decryption permissions
- **Public Data Transparency**: Public data (location, status, timestamps) remains unencrypted for transparency and auditability
- **Immutable Records**: All events are stored on-chain with timestamps, ensuring data integrity
- **Weight Reuse**: Subsequent events reuse the first event's encrypted weight, reducing encryption overhead
- **Byte-by-Byte Encryption**: Contents are encrypted byte-by-byte, allowing variable-length strings while maintaining security

## Architecture Overview

```
┌─────────────────┐
│   Frontend UI   │
│  (React + Vite) │
└────────┬────────┘
         │
         ├─► Wallet Connection (RainbowKit/Wagmi)
         │
         ├─► FHEVM Relayer SDK
         │   ├─► Encrypt weight (euint32)
         │   ├─► Encrypt contents (euint8[])
         │   └─► Decrypt on-demand
         │
         └─► Smart Contract (SecureCargoFlow.sol)
             ├─► Store encrypted data (euint32, euint8[])
             ├─► Manage ACL permissions
             └─► Provide public data access
```

## Technology Details

### FHEVM (Fully Homomorphic Encryption Virtual Machine)

- **Library**: `@fhevm/solidity` for smart contracts
- **SDK**: FHEVM Relayer SDK (loaded from CDN)
- **Encryption Types**:
  - `euint32`: 32-bit encrypted unsigned integer (for weight)
  - `euint8`: 8-bit encrypted unsigned integer (for content bytes)
- **Network Support**: Sepolia testnet (SepoliaConfig) and local Hardhat

### Blockchain Integration

- **Network**: Sepolia testnet (for production) or Hardhat local (for development)
- **Wallet Support**: MetaMask, WalletConnect, Coinbase Wallet, and more
- **Transaction Signing**: EIP-712 typed data signing for decryption requests

## License

MIT

## Installation & Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible Web3 wallet
- Hardhat (for local development)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/JenniferSaul/secure-cargo-flow.git
   cd secure-cargo-flow
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies (Hardhat)
   npm install

   # Install UI dependencies
   cd ui && npm install && cd ..
   ```

3. **Set up environment variables**

   Create `.env` file in the root directory:
   ```env
   # WalletConnect Project ID (get from https://cloud.walletconnect.com/)
   VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here

   # Optional: Infura/Alchemy API keys for better RPC performance
   INFURA_API_KEY=your_infura_key
   ALCHEMY_API_KEY=your_alchemy_key
   ```

4. **Start local development**
   ```bash
   # Terminal 1: Start Hardhat node
   npm run node

   # Terminal 2: Deploy contracts
   npm run deploy:local

   # Terminal 3: Start UI
   cd ui && npm run dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:5173`

## Usage Guide

### Creating a Shipment

1. Connect your wallet using the "Connect Wallet" button
2. Fill in shipment details:
   - Tracking ID (6+ characters, uppercase/numbers/hyphens only)
   - Origin and destination locations
   - Weight (0.1 - 100,000 kg)
   - Contents description
   - Estimated delivery date (future date within 2 years)
3. Click "Create Shipment"

### Adding Cargo Events

1. Select a shipment from the timeline
2. Click "Add First Event" or "Add Event"
3. For first event: Enter weight and contents (will be encrypted)
4. For subsequent events: Weight is inherited, only add location/status
5. Optionally add anomaly detection with custom messages

### Decrypting Data

1. Click the 🔒 "Locked" button on any encrypted event
2. Confirm wallet signature for decryption request
3. FHEVM relayer processes decryption off-chain
4. View decrypted weight and contents

## Troubleshooting

### Common Issues

**FHE Initialization Failed**
- Ensure MetaMask is connected to the correct network
- Check console for network-specific errors
- Try refreshing the page

**Transaction Failed**
- Verify sufficient ETH for gas fees
- Check network congestion
- Ensure contract is deployed on current network

**Decryption Not Working**
- Verify you have permission to decrypt (shipment creator only)
- Check FHEVM relayer status
- Ensure proper wallet signature

### Network Configuration

**Local Development (Hardhat)**
- Chain ID: 31337
- RPC: http://127.0.0.1:8545
- FHEVM: Automatic mock mode

**Sepolia Testnet**
- Chain ID: 11155111
- Use real FHEVM relayer
- Requires test ETH

## API Reference

### Smart Contract Functions

#### Write Functions
- `createShipment(string trackingId, string origin, string destination, uint256 estimatedDelivery)` - Create new shipment
- `addCargoEvent(...)` - Add tracking event with encrypted data
- `addCargoEventWithAnomaly(...)` - Add event with anomaly detection

#### Read Functions
- `getShipment(string trackingId)` - Get shipment details
- `getEventCount(string trackingId)` - Get number of events
- `getEncryptedWeight(string trackingId, uint256 eventIndex)` - Get encrypted weight
- `getContentsLength(string trackingId, uint256 eventIndex)` - Get content length
- `getCargoEventPublic(...)` - Get public event data

### Frontend Hooks

- `useSecureCargoFlow()` - Main contract interaction hook
- `useFHEVM()` - FHEVM SDK integration
- `useAccount()` - Wagmi account management

## Security Considerations

- All sensitive data encrypted using FHEVM
- Only shipment creators can add events and decrypt data
- Immutable blockchain records ensure data integrity
- EIP-712 signatures for decryption authorization
- Access control enforced at smart contract level

## Development

### Running Tests

```bash
# Local tests (with FHEVM mock)
npm run test:local

# Sepolia tests (with real FHEVM)
npm run test:sepolia
```

### Building for Production

```bash
# Build contracts
npm run compile

# Build UI
cd ui && npm run build && cd ..

# Deploy to Sepolia
npm run deploy:sepolia
```

### Code Quality

- ESLint for JavaScript/TypeScript
- Prettier for code formatting
- Hardhat gas reporter for optimization
- Comprehensive test coverage

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR
- Use conventional commit messages

### Bug Reports

Please use the GitHub issue tracker to report bugs. Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/console logs
- Network used (local/Sepolia/etc.)

## Performance Optimization

### Gas Optimization Strategies

The contract implements several gas optimization techniques:

1. **Packed Storage**: Shipment struct uses efficient data types to minimize storage slots
2. **Event Indexing**: Critical fields are indexed for efficient off-chain querying
3. **Weight Reuse**: Subsequent events reuse encrypted weight from first event, avoiding re-encryption costs
4. **Batch Operations**: Contents decryption uses batch fetching to minimize RPC calls
5. **Storage Optimization**: Public data stored separately from encrypted data to reduce gas costs

### Frontend Performance

- **Lazy Loading**: Components loaded on-demand to reduce initial bundle size
- **Memoization**: React hooks use memoization to prevent unnecessary re-renders
- **Batch Decryption**: Multiple encrypted bytes decrypted in single API call
- **Caching**: Contract data cached locally to minimize blockchain queries

### Network Considerations

- **Sepolia Testnet**: Optimized for testnet deployment with lower gas costs
- **Local Development**: Uses Hardhat node for rapid iteration without gas fees
- **RPC Optimization**: Supports multiple RPC providers (Infura, Alchemy) for redundancy

## Use Cases

### Supply Chain Management

Secure Cargo Flow enables enterprises to track sensitive cargo shipments while maintaining privacy:

- **Pharmaceutical Shipping**: Track temperature-sensitive medications with encrypted weight and contents
- **Luxury Goods Transport**: Monitor high-value items without revealing shipment details publicly
- **Food Safety Tracking**: Record cargo events with anomaly detection for quality control
- **International Trade**: Track shipments across borders with encrypted sensitive data

### Compliance & Auditing

- **Regulatory Compliance**: Immutable blockchain records satisfy audit requirements
- **Selective Disclosure**: Authorized parties can decrypt data when needed for compliance
- **Transparency**: Public data (location, status) remains transparent for stakeholders
- **Privacy Protection**: Sensitive data encrypted to meet GDPR and privacy regulations

## Future Enhancements

### Planned Features

- **Multi-Signature Support**: Require multiple approvals for critical shipment operations
- **Automated Anomaly Detection**: AI-powered anomaly detection based on historical patterns
- **Mobile Application**: Native iOS and Android apps for on-the-go tracking
- **API Integration**: RESTful API for enterprise system integration
- **Multi-Chain Deployment**: Support for additional networks (Polygon, Optimism, Arbitrum)

### Research & Development

- **Zero-Knowledge Proofs**: Enhanced privacy using ZK-SNARKs for additional verification
- **Cross-Chain Interoperability**: Track shipments across multiple blockchain networks
- **Decentralized Storage**: Integration with IPFS for large file attachments
- **Smart Contract Upgrades**: Upgradeable contract pattern for future enhancements

