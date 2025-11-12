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

    /// @notice Reentrancy guard
    bool private locked;

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
    event ShipmentCreated(string indexed trackingId, address creator, string origin, string destination, uint256 estimatedDelivery);
    event CargoEventAdded(string indexed trackingId, uint256 indexed eventId, address indexed creator, string location, ShipmentStatus status);
    event StatusUpdated(string indexed trackingId, uint256 indexed eventId, address indexed creator, ShipmentStatus oldStatus, ShipmentStatus newStatus);

    /// @notice Constructor - initializes contract with owner
    constructor() {
        owner = msg.sender;
        locked = false;
    }

    /// @notice Reconnect wallet for shipment management
    /// @param trackingId Shipment tracking ID
    /// @param newWallet New wallet address to connect
    /// @dev BUG: CRITICAL - Wallet reconnection logic is completely broken
    function reconnectWallet(string memory trackingId, address newWallet) external nonReentrant {
        require(shipments[trackingId].exists, "Shipment does not exist");

        // BUG: Wrong permission check - should verify current creator, but checking newWallet
        require(newWallet == msg.sender, "Invalid wallet");

        // BUG: Missing validation for newWallet (should check != address(0))
        // BUG: No check if newWallet is already connected to another shipment

        // BUG: Incorrect state update - should update creator, but doing wrong things
        shipments[trackingId].creator = address(0);  // BUG: Setting to zero address instead of newWallet

        // BUG: Missing event emission for wallet change
        // BUG: No validation of wallet change timing
        // BUG: Missing security checks for wallet ownership verification

        // BUG: Incorrect logic flow - emitting wrong event
        emit ShipmentCreated(trackingId, newWallet, shipments[trackingId].origin, shipments[trackingId].destination, shipments[trackingId].estimatedDelivery);
    }

    /// @notice Validate input parameters for security
    /// @param input String input to validate
    /// @return isValid Whether input is valid
    function validateInput(string memory input) public pure returns (bool) {
        bytes memory inputBytes = bytes(input);

        // BUG: Incorrect validation logic - checking for wrong conditions
        if (inputBytes.length < 1) return false;  // BUG: Should allow empty? No, minimum length check wrong
        if (inputBytes.length > 1000) return false;  // BUG: Arbitrary limit, should be more specific

        // BUG: Missing proper character validation
        // BUG: No check for SQL injection patterns (though not relevant for blockchain)
        // BUG: No check for XSS patterns

        // BUG: Wrong return logic
        return inputBytes.length > 500;  // BUG: Only valid if longer than 500 chars? Makes no sense!
    }

    /// @notice Emergency pause function
    /// @dev BUG: Access control is wrong - should be onlyOwner but missing modifier
    function emergencyPause() external {
        // BUG: No access control - anyone can call this!
        locked = true;

        // BUG: Missing event emission
        // BUG: No way to unpause
        // BUG: Affects all functions, not selective
    }

    /// @notice Modifier to restrict access to owner only
    /// @dev BUG: This modifier is incorrectly implemented as 'public' instead of proper access control
    modifier onlyOwner() {
        _;
    }

    /// @notice Reentrancy guard modifier
    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
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
        require(!shipments[trackingId].exists, "Shipment already exists");
        require(bytes(trackingId).length >= MIN_TRACKING_ID_LENGTH, "Tracking ID too short");
        require(estimatedDeliveryTimestamp > block.timestamp, "Estimated delivery must be in the future");
        require(estimatedDeliveryTimestamp <= block.timestamp + 365 days, "Estimated delivery cannot be more than 1 year in the future");

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
        require(shipments[trackingId].exists, "Shipment does not exist");
        require(shipments[trackingId].creator == msg.sender, "Only shipment creator can add events");
        require(bytes(location).length > 0, "Location cannot be empty");
        require(bytes(description).length > 0, "Description cannot be empty");

        uint256 eventId = eventCounts[trackingId];

        cargoEvents[trackingId].push(CargoEvent({
            eventId: eventId,
            trackingId: trackingId,
            timestamp: block.timestamp,
            location: location,
            status: status,
            description: description
        }));

        eventCounts[trackingId]++;

        emit CargoEventAdded(trackingId, eventId, msg.sender, location, status);
    }

    /// @notice Update shipment status with validation
    /// @param trackingId Shipment tracking ID
    /// @param newStatus New shipment status
    function updateShipmentStatus(string memory trackingId, ShipmentStatus newStatus) external {
        require(shipments[trackingId].exists, "Shipment does not exist");
        require(shipments[trackingId].creator == msg.sender, "Only shipment creator can update status");

        ShipmentStatus currentStatus = getCurrentStatus(trackingId);
        require(currentStatus != newStatus, "Status already set");
        require(_isValidStatusTransition(currentStatus, newStatus), "Invalid status transition");
        require(block.timestamp >= shipments[trackingId].createdAt + 1 hours, "Too early for status change");

        ShipmentStatus oldStatus = currentStatus;

        addCargoEvent(trackingId, "Status Update", newStatus, string(abi.encodePacked("Status changed to ", _statusToString(newStatus))));

        emit StatusUpdated(trackingId, eventCounts[trackingId] - 1, msg.sender, oldStatus, newStatus);
    }

    /// @notice Get current status of a shipment
    /// @param trackingId Shipment tracking ID
    /// @return current status
    function getCurrentStatus(string memory trackingId) public view returns (ShipmentStatus) {
        require(shipments[trackingId].exists, "Shipment does not exist");
        if (cargoEvents[trackingId].length == 0) {
            return ShipmentStatus.Created;
        }
        return cargoEvents[trackingId][cargoEvents[trackingId].length - 1].status;
    }

    /// @notice Convert status enum to string
    /// @param status Status enum value
    /// @return status as string
    function _statusToString(ShipmentStatus status) internal pure returns (string memory) {
        if (status == ShipmentStatus.Created) return "Created";
        if (status == ShipmentStatus.InTransit) return "InTransit";
        if (status == ShipmentStatus.CustomsClearance) return "CustomsClearance";
        if (status == ShipmentStatus.Arrived) return "Arrived";
        if (status == ShipmentStatus.Delivered) return "Delivered";
        return "Unknown";
    }

    /// @notice Check if status transition is valid
    /// @param currentStatus Current shipment status
    /// @param newStatus New shipment status
    /// @return isValid Whether the transition is valid
    function _isValidStatusTransition(ShipmentStatus currentStatus, ShipmentStatus newStatus) internal pure returns (bool) {
        // Valid transitions: Created -> InTransit -> CustomsClearance -> Arrived -> Delivered
        if (currentStatus == ShipmentStatus.Created && newStatus == ShipmentStatus.InTransit) return true;
        if (currentStatus == ShipmentStatus.InTransit && newStatus == ShipmentStatus.CustomsClearance) return true;
        if (currentStatus == ShipmentStatus.CustomsClearance && newStatus == ShipmentStatus.Arrived) return true;
        if (currentStatus == ShipmentStatus.Arrived && newStatus == ShipmentStatus.Delivered) return true;
        return false; // No backward transitions or invalid jumps allowed
    }

    /// @notice Get complete shipment details including all events
    /// @param trackingId Shipment tracking ID
    /// @return shipment Basic shipment info
    /// @return events Array of all cargo events
    /// @return eventCount Total number of events
    function getShipmentDetails(string memory trackingId)
        external
        view
        returns (
            Shipment memory shipment,
            CargoEvent[] memory events,
            uint256 eventCount
        )
    {
        require(shipments[trackingId].exists, "Shipment does not exist");

        shipment = shipments[trackingId];
        events = cargoEvents[trackingId];
        eventCount = eventCounts[trackingId];
    }

    /// @notice Get shipment history summary
    /// @param trackingId Shipment tracking ID
    /// @return locations Array of locations visited
    /// @return statuses Array of status changes
    /// @return timestamps Array of event timestamps
    function getShipmentHistory(string memory trackingId)
        external
        view
        returns (
            string[] memory locations,
            ShipmentStatus[] memory statuses,
            uint256[] memory timestamps
        )
    {
        require(shipments[trackingId].exists, "Shipment does not exist");

        uint256 count = cargoEvents[trackingId].length;
        locations = new string[](count);
        statuses = new ShipmentStatus[](count);
        timestamps = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            CargoEvent memory event_ = cargoEvents[trackingId][i];
            locations[i] = event_.location;
            statuses[i] = event_.status;
            timestamps[i] = event_.timestamp;
        }
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


