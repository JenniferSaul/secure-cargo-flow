// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Secure Cargo Flow - Encrypted Cargo Tracking System
/// @notice A blockchain-based logistics tracking system with end-to-end encryption
/// @dev Uses FHEVM for encrypting sensitive cargo data (weight, contents, anomalies)
contract SecureCargoFlow is SepoliaConfig {
    /// @notice Shipment status enum
    enum ShipmentStatus {
        Created,
        InTransit,
        CustomsClearance,
        Arrived,
        Delivered
    }

    /// @notice Cargo event structure
    struct CargoEvent {
        uint256 eventId;
        string trackingId;
        uint256 timestamp;
        string location;
        ShipmentStatus status;
        euint32 encryptedWeight; // Weight in grams (encrypted)
        euint8[] encContentsBytes; // Contents encrypted as bytes (one euint8 per byte)
        bool hasAnomaly;
        string anomalyDescription; // Public anomaly description
    }

    /// @notice Shipment structure
    struct Shipment {
        string trackingId;
        string origin;
        string destination;
        uint256 createdAt;
        uint256 estimatedDelivery;
        address creator;
        bool exists;
    }

    /// @notice Mapping from tracking ID to shipment
    mapping(string => Shipment) public shipments;
    
    /// @notice Mapping from tracking ID to cargo events
    mapping(string => CargoEvent[]) public cargoEvents;
    
    /// @notice Mapping from tracking ID to event count
    mapping(string => uint256) public eventCounts;
    
    /// @notice Total shipment count
    uint256 public totalShipments;

    /// @notice Events
    event ShipmentCreated(string indexed trackingId, address indexed creator, string origin, string destination);
    event CargoEventAdded(string indexed trackingId, uint256 indexed eventId, string location, ShipmentStatus status);
    event AnomalyDetected(string indexed trackingId, uint256 indexed eventId, string description);

    /// @notice Create a new shipment
    /// @param trackingId Unique tracking identifier
    /// @param origin Origin location
    /// @param destination Destination location
    /// @param estimatedDeliveryTimestamp Estimated delivery timestamp
    function createShipment(
        string memory trackingId,
        string memory origin,
        string memory destination,
        uint256 estimatedDeliveryTimestamp
    ) external {
        require(!shipments[trackingId].exists, "Shipment already exists");
        require(bytes(trackingId).length >= 6, "Tracking ID too short");

        shipments[trackingId] = Shipment({
            trackingId: trackingId,
            origin: origin,
            destination: destination,
            createdAt: block.timestamp,
            estimatedDelivery: estimatedDeliveryTimestamp,
            creator: msg.sender,
            exists: true
        });

        totalShipments++;
        emit ShipmentCreated(trackingId, msg.sender, origin, destination);
    }

    /// @notice Add a cargo event with encrypted weight and contents
    /// @param trackingId Shipment tracking ID
    /// @param location Current location
    /// @param status Current status
    /// @param encryptedWeight Encrypted weight value (in grams)
    /// @param weightInputProof Proof for encrypted weight (should be same as inputProof if encrypted together)
    /// @param encContentsBytes Contents encrypted as bytes (each item is one byte as externalEuint8)
    /// @param inputProof Relayer input proof for contents bytes (can be same as weightInputProof if encrypted together)
    function addCargoEvent(
        string memory trackingId,
        string memory location,
        ShipmentStatus status,
        externalEuint32 encryptedWeight,
        bytes calldata weightInputProof,
        externalEuint8[] calldata encContentsBytes,
        bytes calldata inputProof
    ) external {
        require(shipments[trackingId].exists, "Shipment does not exist");
        require(encContentsBytes.length > 0, "Empty contents");
        
        uint256 eventId = eventCounts[trackingId];
        
        cargoEvents[trackingId].push(CargoEvent({
            eventId: eventId,
            trackingId: trackingId,
            timestamp: block.timestamp,
            location: location,
            status: status,
            encryptedWeight: _getOrImportWeight(trackingId, encryptedWeight, weightInputProof),
            encContentsBytes: _importEncryptedContents(encContentsBytes, inputProof),
            hasAnomaly: false,
            anomalyDescription: ""
        }));

        eventCounts[trackingId]++;

        emit CargoEventAdded(trackingId, eventId, location, status);
    }

    /// @notice Helper function to import encrypted contents bytes
    /// @dev Internal function to reduce stack depth
    function _importEncryptedContents(
        externalEuint8[] calldata encContentsBytes,
        bytes calldata inputProof
    ) internal returns (euint8[] memory) {
        euint8[] memory contentsBytes = new euint8[](encContentsBytes.length);
        for (uint256 i = 0; i < encContentsBytes.length; i++) {
            euint8 b = FHE.fromExternal(encContentsBytes[i], inputProof);
            contentsBytes[i] = b;
            FHE.allowThis(b);
            FHE.allow(b, msg.sender);
        }
        return contentsBytes;
    }

    /// @notice Helper function to get or import weight
    /// @dev Internal function to reduce stack depth
    function _getOrImportWeight(
        string memory trackingId,
        externalEuint32 encryptedWeight,
        bytes calldata weightInputProof
    ) internal returns (euint32) {
        if (eventCounts[trackingId] > 0) {
            return cargoEvents[trackingId][eventCounts[trackingId] - 1].encryptedWeight;
        } else {
            euint32 weight = FHE.fromExternal(encryptedWeight, weightInputProof);
            FHE.allowThis(weight);
            FHE.allow(weight, msg.sender);
            return weight;
        }
    }

    /// @notice Add a cargo event with anomaly detection
    /// @param trackingId Shipment tracking ID
    /// @param location Current location
    /// @param status Current status
    /// @param encryptedWeight Encrypted weight value (in grams)
    /// @param weightInputProof Proof for encrypted weight
    /// @param encContentsBytes Contents encrypted as bytes (each item is one byte as externalEuint8)
    /// @param inputProof Relayer input proof for both weight and contents bytes
    /// @param anomalyDescription Description of detected anomaly
    function addCargoEventWithAnomaly(
        string memory trackingId,
        string memory location,
        ShipmentStatus status,
        externalEuint32 encryptedWeight,
        bytes calldata weightInputProof,
        externalEuint8[] calldata encContentsBytes,
        bytes calldata inputProof,
        string memory anomalyDescription
    ) external {
        require(shipments[trackingId].exists, "Shipment does not exist");
        require(encContentsBytes.length > 0, "Empty contents");
        
        uint256 eventId = eventCounts[trackingId];
        
        cargoEvents[trackingId].push(CargoEvent({
            eventId: eventId,
            trackingId: trackingId,
            timestamp: block.timestamp,
            location: location,
            status: status,
            encryptedWeight: _getOrImportWeight(trackingId, encryptedWeight, weightInputProof),
            encContentsBytes: _importEncryptedContents(encContentsBytes, inputProof),
            hasAnomaly: true,
            anomalyDescription: anomalyDescription
        }));

        eventCounts[trackingId]++;

        emit CargoEventAdded(trackingId, eventId, location, status);
        emit AnomalyDetected(trackingId, eventId, anomalyDescription);
    }

    /// @notice Get shipment details
    /// @param trackingId Shipment tracking ID
    /// @return shipment Shipment struct
    function getShipment(string memory trackingId) external view returns (Shipment memory) {
        require(shipments[trackingId].exists, "Shipment does not exist");
        return shipments[trackingId];
    }

    /// @notice Get cargo event count for a shipment
    /// @param trackingId Shipment tracking ID
    /// @return count Number of events
    function getEventCount(string memory trackingId) external view returns (uint256) {
        require(shipments[trackingId].exists, "Shipment does not exist");
        return eventCounts[trackingId];
    }

    /// @notice Get encrypted weight for a specific event
    /// @param trackingId Shipment tracking ID
    /// @param eventIndex Event index
    /// @return encryptedWeight Encrypted weight value
    function getEncryptedWeight(string memory trackingId, uint256 eventIndex) 
        external 
        view 
        returns (euint32) 
    {
        require(shipments[trackingId].exists, "Shipment does not exist");
        require(eventIndex < cargoEvents[trackingId].length, "Event does not exist");
        return cargoEvents[trackingId][eventIndex].encryptedWeight;
    }

    /// @notice Get the length of encrypted contents for a specific event
    /// @param trackingId Shipment tracking ID
    /// @param eventIndex Event index
    /// @return length Number of encrypted bytes
    function getContentsLength(string memory trackingId, uint256 eventIndex) 
        external 
        view 
        returns (uint256) 
    {
        require(shipments[trackingId].exists, "Shipment does not exist");
        require(eventIndex < cargoEvents[trackingId].length, "Event does not exist");
        return cargoEvents[trackingId][eventIndex].encContentsBytes.length;
    }

    /// @notice Get a single encrypted byte from contents for a specific event
    /// @param trackingId Shipment tracking ID
    /// @param eventIndex Event index
    /// @param byteIndex Byte index within contents
    /// @return encryptedByte Encrypted byte value (euint8)
    function getEncryptedContentsByte(
        string memory trackingId, 
        uint256 eventIndex, 
        uint256 byteIndex
    ) 
        external 
        view 
        returns (euint8) 
    {
        require(shipments[trackingId].exists, "Shipment does not exist");
        require(eventIndex < cargoEvents[trackingId].length, "Event does not exist");
        CargoEvent memory event_ = cargoEvents[trackingId][eventIndex];
        require(byteIndex < event_.encContentsBytes.length, "Byte index out of bounds");
        return event_.encContentsBytes[byteIndex];
    }

    /// @notice Get cargo event details (public fields only)
    /// @param trackingId Shipment tracking ID
    /// @param eventIndex Event index
    /// @return eventId Event ID
    /// @return timestamp Event timestamp
    /// @return location Event location
    /// @return status Event status
    /// @return hasAnomaly Whether anomaly was detected
    /// @return anomalyDescription Anomaly description
    /// @dev Contents is encrypted, use getEncryptedContents to retrieve it
    function getCargoEventPublic(string memory trackingId, uint256 eventIndex)
        external
        view
        returns (
            uint256 eventId,
            uint256 timestamp,
            string memory location,
            ShipmentStatus status,
            bool hasAnomaly,
            string memory anomalyDescription
        )
    {
        require(shipments[trackingId].exists, "Shipment does not exist");
        require(eventIndex < cargoEvents[trackingId].length, "Event does not exist");
        
        CargoEvent memory event_ = cargoEvents[trackingId][eventIndex];
        return (
            event_.eventId,
            event_.timestamp,
            event_.location,
            event_.status,
            event_.hasAnomaly,
            event_.anomalyDescription
        );
    }
}


