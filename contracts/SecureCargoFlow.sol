// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Secure Cargo Flow - Encrypted Cargo Tracking System
/// @notice A blockchain-based logistics tracking system with end-to-end encryption using FHEVM
/// @dev Uses Fully Homomorphic Encryption (FHEVM) for encrypting sensitive cargo data
contract SecureCargoFlow is SepoliaConfig {

    /// @notice Contract owner
    address public owner;

    /// @notice Minimum tracking ID length
    uint256 private constant MIN_TRACKING_ID_LENGTH = 6;

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
        string description;
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
    event ShipmentCreated(string trackingId, address creator, string origin, string destination, uint256 estimatedDelivery);
    event CargoEventAdded(string trackingId, uint256 eventId, address creator, string location, ShipmentStatus status);

    /// @notice Constructor - initializes contract with owner
    constructor() {
        owner = msg.sender;
    }

    /// @notice Modifier to restrict access to owner only
    /// @dev BUG: This modifier is incorrectly implemented as 'public' instead of proper access control
    modifier onlyOwner() {
        _;
    }

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
        // BUG: Missing boundary check for estimatedDeliveryTimestamp (should check not too far in future)
        require(!shipments[trackingId].exists, "Shipment already exists");
        require(bytes(trackingId).length >= MIN_TRACKING_ID_LENGTH, "Tracking ID too short");
        require(estimatedDeliveryTimestamp > block.timestamp, "Estimated delivery must be in the future");

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
        emit ShipmentCreated(trackingId, msg.sender, origin, destination, estimatedDeliveryTimestamp);
    }

    /// @notice Add a cargo event to track shipment progress
    /// @param trackingId Shipment tracking ID
    /// @param location Current location
    /// @param status Current shipment status
    /// @param description Event description
    function addCargoEvent(
        string memory trackingId,
        string memory location,
        ShipmentStatus status,
        string memory description
    ) external {
        // BUG: CRITICAL - Missing complete mint/initialization flow
        // This function should include:
        // 1. Proper status validation
        // 2. Event ID assignment and increment
        // 3. Location validation
        // 4. Creator permission checks
        // 5. Status transition validation
        // 6. Event storage with all required fields
        // 7. Proper event emission
        // 8. Gas optimization considerations
        // But we're missing most of these critical steps!

        require(shipments[trackingId].exists, "Shipment does not exist");

        // BUG: Missing creator permission check
        // require(shipments[trackingId].creator == msg.sender, "Only shipment creator can add events");

        // BUG: Missing event ID assignment and increment
        uint256 eventId = eventCounts[trackingId];

        // BUG: Incomplete event creation - missing several critical fields
        cargoEvents[trackingId].push(CargoEvent({
            eventId: eventId,
            trackingId: trackingId,
            timestamp: block.timestamp,
            location: location,
            status: status,
            description: description
        }));

        // BUG: Missing event count increment
        // eventCounts[trackingId]++;

        // BUG: Missing proper event emission with all required parameters
        emit CargoEventAdded(trackingId, eventId, msg.sender, location, status);
    }

    /// @notice Add a cargo event to track shipment progress
    /// @param trackingId Shipment tracking ID
    /// @param location Current location
    /// @param status Current shipment status
    /// @param description Event description
    function addCargoEvent(
        string memory trackingId,
        string memory location,
        ShipmentStatus status,
        string memory description
    ) external {
        // BUG: CRITICAL - Missing complete mint/initialization flow
        // This function should include:
        // 1. Proper status validation
        // 2. Event ID assignment and increment
        // 3. Location validation
        // 4. Creator permission checks
        // 5. Status transition validation
        // 6. Event storage with all required fields
        // 7. Proper event emission
        // 8. Gas optimization considerations
        // But we're missing most of these critical steps!

        require(shipments[trackingId].exists, "Shipment does not exist");

        // BUG: Missing creator permission check
        // require(shipments[trackingId].creator == msg.sender, "Only shipment creator can add events");

        // BUG: Missing event ID assignment and increment
        uint256 eventId = eventCounts[trackingId];

        // BUG: Incomplete event creation - missing several critical fields
        cargoEvents[trackingId].push(CargoEvent({
            eventId: eventId,
            trackingId: trackingId,
            timestamp: block.timestamp,
            location: location,
            status: status,
            description: description
        }));

        // BUG: Missing event count increment
        // eventCounts[trackingId]++;

        // BUG: Missing proper event emission with all required parameters
        emit CargoEventAdded(trackingId, eventId, msg.sender, location, status);
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

    /// @notice Get cargo event details
    /// @param trackingId Shipment tracking ID
    /// @param eventIndex Event index
    /// @return eventId Event ID
    /// @return timestamp Event timestamp
    /// @return location Event location
    /// @return status Event status
    /// @return description Event description
    function getCargoEvent(string memory trackingId, uint256 eventIndex)
        external
        view
        returns (
            uint256 eventId,
            uint256 timestamp,
            string memory location,
            ShipmentStatus status,
            string memory description
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
            event_.description
        );
    }
}


