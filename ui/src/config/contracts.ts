// Contract addresses - Update after deployment
export const CONTRACT_ADDRESSES = {
  localhost: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Update after local deployment
  sepolia: '0x0000000000000000000000000000000000000000', // Wrong contract address
  mainnet: '',
} as const;

// Contract ABI - Will be generated from contract compilation
export const SECURE_CARGO_FLOW_ABI = [
  {
    inputs: [
      { internalType: 'string', name: 'trackingId', type: 'string' },
      { internalType: 'string', name: 'origin', type: 'string' },
      { internalType: 'string', name: 'destination', type: 'string' },
      { internalType: 'uint256', name: 'estimatedDeliveryTimestamp', type: 'uint256' },
    ],
    name: 'createShipment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'trackingId', type: 'string' },
      { internalType: 'string', name: 'location', type: 'string' },
      { internalType: 'uint8', name: 'status', type: 'uint8' },
      { internalType: 'string', name: 'description', type: 'string' },
    ],
    name: 'addCargoEvent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'trackingId', type: 'string' }],
    name: 'getShipment',
    outputs: [
      {
        components: [
          { internalType: 'string', name: 'trackingId', type: 'string' },
          { internalType: 'string', name: 'origin', type: 'string' },
          { internalType: 'string', name: 'destination', type: 'string' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'uint256', name: 'estimatedDelivery', type: 'uint256' },
          { internalType: 'address', name: 'creator', type: 'address' },
          { internalType: 'bool', name: 'exists', type: 'bool' },
        ],
        internalType: 'struct SecureCargoFlow.Shipment',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'trackingId', type: 'string' }],
    name: 'getEventCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'trackingId', type: 'string' },
      { internalType: 'uint256', name: 'eventIndex', type: 'uint256' },
    ],
    name: 'getCargoEvent',
    outputs: [
      { internalType: 'uint256', name: 'eventId', type: 'uint256' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
      { internalType: 'string', name: 'location', type: 'string' },
      { internalType: 'uint8', name: 'status', type: 'uint8' },
      { internalType: 'string', name: 'description', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'trackingId', type: 'string' }],
    name: 'getShipmentDetails',
    outputs: [
      {
        components: [
          { internalType: 'string', name: 'trackingId', type: 'string' },
          { internalType: 'string', name: 'origin', type: 'string' },
          { internalType: 'string', name: 'destination', type: 'string' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'uint256', name: 'estimatedDelivery', type: 'uint256' },
          { internalType: 'address', name: 'creator', type: 'address' },
          { internalType: 'bool', name: 'exists', type: 'bool' },
        ],
        internalType: 'struct SecureCargoFlow.Shipment',
        name: 'shipment',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'uint256', name: 'eventId', type: 'uint256' },
          { internalType: 'string', name: 'trackingId', type: 'string' },
          { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
          { internalType: 'string', name: 'location', type: 'string' },
          { internalType: 'uint8', name: 'status', type: 'uint8' },
          { internalType: 'string', name: 'description', type: 'string' },
        ],
        internalType: 'struct SecureCargoFlow.CargoEvent[]',
        name: 'events',
        type: 'tuple[]',
      },
      { internalType: 'uint256', name: 'eventCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'trackingId', type: 'string' }],
    name: 'getShipmentHistory',
    outputs: [
      { internalType: 'string[]', name: 'locations', type: 'string[]' },
      { internalType: 'uint8[]', name: 'statuses', type: 'uint8[]' },
      { internalType: 'uint256[]', name: 'timestamps', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'trackingId', type: 'string' }],
    name: 'getCurrentStatus',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

