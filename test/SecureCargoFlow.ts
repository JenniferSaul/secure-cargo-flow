import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SecureCargoFlow, SecureCargoFlow__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SecureCargoFlow")) as SecureCargoFlow__factory;
  const secureCargoFlowContract = (await factory.deploy()) as SecureCargoFlow;
  const secureCargoFlowContractAddress = await secureCargoFlowContract.getAddress();

  return { secureCargoFlowContract, secureCargoFlowContractAddress };
}

describe("SecureCargoFlow", function () {
  let signers: Signers;
  let secureCargoFlowContract: SecureCargoFlow;
  let secureCargoFlowContractAddress: string;
  let fhevmInstance: FhevmType;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
    fhevmInstance = fhevm; // Use the fhevm imported from hardhat
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevmInstance.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ secureCargoFlowContract, secureCargoFlowContractAddress } = await deployFixture());
  });

  it("should create a shipment successfully", async function () {
    const trackingId = "CARGO-2024-001";
    const origin = "Shanghai Port";
    const destination = "Los Angeles Port";
    const estimatedDelivery = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days from now

    const tx = await secureCargoFlowContract
      .connect(signers.alice)
      .createShipment(trackingId, origin, destination, estimatedDelivery);
    await tx.wait();

    const shipment = await secureCargoFlowContract.getShipment(trackingId);
    expect(shipment.exists).to.be.true;
    expect(shipment.trackingId).to.eq(trackingId);
    expect(shipment.origin).to.eq(origin);
    expect(shipment.destination).to.eq(destination);
    expect(shipment.creator).to.eq(signers.alice.address);
  });

  it("should add a cargo event with encrypted weight", async function () {
    const trackingId = "CARGO-2024-001";
    const origin = "Shanghai Port";
    const destination = "Los Angeles Port";
    const estimatedDelivery = Math.floor(Date.now() / 1000) + 86400 * 7;

    // Create shipment first
    let tx = await secureCargoFlowContract
      .connect(signers.alice)
      .createShipment(trackingId, origin, destination, estimatedDelivery);
    await tx.wait();

    // Encrypt weight (2500 kg = 2500000 grams)
    const weightInGrams = 2500000;
    const encryptedWeight = await fhevmInstance
      .createEncryptedInput(secureCargoFlowContractAddress, signers.alice.address)
      .add32(weightInGrams)
      .encrypt();

    // Encrypt contents byte by byte (like SecretBank)
    const contents = "Electronic Components (Class A)";
    const contentsBytes = new TextEncoder().encode(contents.slice(0, 64)); // Limit to 64 bytes
    const contentsInput = fhevmInstance.createEncryptedInput(secureCargoFlowContractAddress, signers.alice.address);
    for (const b of contentsBytes) {
      contentsInput.add8(b); // Encrypt each byte as euint8
    }
    const encryptedContents = await contentsInput.encrypt();

    // Add cargo event
    tx = await secureCargoFlowContract
      .connect(signers.alice)
      .addCargoEvent(
        trackingId,
        "Shanghai Port, China",
        0, // ShipmentStatus.Created
        encryptedWeight.handles[0],
        encryptedWeight.inputProof,
        encryptedContents.handles, // Array of byte handles
        encryptedContents.inputProof
      );
    await tx.wait();

    const eventCount = await secureCargoFlowContract.getEventCount(trackingId);
    expect(eventCount).to.eq(1);

    // Get encrypted weight and decrypt
    const encryptedWeightHandle = await secureCargoFlowContract.getEncryptedWeight(trackingId, 0);
    const decryptedWeight = await fhevmInstance.userDecryptEuint(
      FhevmType.euint32,
      encryptedWeightHandle,
      secureCargoFlowContractAddress,
      signers.alice
    );

    expect(decryptedWeight).to.eq(weightInGrams);

    // Test that encrypted contents are stored correctly and can be decrypted
    const contentsLength = await secureCargoFlowContract.getContentsLength(trackingId, 0);
    expect(contentsLength).to.eq(contentsBytes.length);

    // Decrypt each byte to verify content
    const out: number[] = [];
    for (let i = 0; i < contentsBytes.length; i++) {
      const encByte = await secureCargoFlowContract.getEncryptedContentsByte(trackingId, 0, i);
      const clear = await fhevmInstance.userDecryptEuint(
        FhevmType.euint8,
        encByte,
        secureCargoFlowContractAddress,
        signers.alice
      );
      out.push(Number(clear));
    }
    const decoded = new TextDecoder().decode(Uint8Array.from(out));
    expect(decoded).to.eq(contents);
  });

  it("should add a cargo event with anomaly", async function () {
    const trackingId = "CARGO-2024-002";
    const origin = "Shanghai Port";
    const destination = "Los Angeles Port";
    const estimatedDelivery = Math.floor(Date.now() / 1000) + 86400 * 7;

    // Create shipment
    let tx = await secureCargoFlowContract
      .connect(signers.alice)
      .createShipment(trackingId, origin, destination, estimatedDelivery);
    await tx.wait();

    // Encrypt weight
    const weightInGrams = 2450000;
    const encryptedWeight = await fhevmInstance
      .createEncryptedInput(secureCargoFlowContractAddress, signers.alice.address)
      .add32(weightInGrams)
      .encrypt();

    // Encrypt contents byte by byte (like SecretBank)
    const contents = "Electronic Components (Class A)";
    const contentsBytes = new TextEncoder().encode(contents.slice(0, 64)); // Limit to 64 bytes
    const contentsInput = fhevmInstance.createEncryptedInput(secureCargoFlowContractAddress, signers.alice.address);
    for (const b of contentsBytes) {
      contentsInput.add8(b); // Encrypt each byte as euint8
    }
    const encryptedContents = await contentsInput.encrypt();

    // Add cargo event with anomaly
    tx = await secureCargoFlowContract
      .connect(signers.alice)
      .addCargoEventWithAnomaly(
        trackingId,
        "Pacific Ocean Transit",
        1, // ShipmentStatus.InTransit
        encryptedWeight.handles[0],
        encryptedWeight.inputProof,
        encryptedContents.handles, // Array of byte handles
        encryptedContents.inputProof,
        "Temperature spike detected: +5°C above threshold"
      );
    await tx.wait();

    const eventCount = await secureCargoFlowContract.getEventCount(trackingId);
    expect(eventCount).to.eq(1);

    // Get event public data
    const eventPublic = await secureCargoFlowContract.getCargoEventPublic(trackingId, 0);
    expect(eventPublic.hasAnomaly).to.be.true;
    expect(eventPublic.anomalyDescription).to.eq("Temperature spike detected: +5°C above threshold");
    
    // Test that encrypted contents are stored correctly
    const contentsLength = await secureCargoFlowContract.getContentsLength(trackingId, 0);
    expect(contentsLength).to.eq(contentsBytes.length);
  });

  it("should prevent creating duplicate shipments", async function () {
    const trackingId = "CARGO-2024-003";
    const origin = "Shanghai Port";
    const destination = "Los Angeles Port";
    const estimatedDelivery = Math.floor(Date.now() / 1000) + 86400 * 7;

    // Create shipment
    let tx = await secureCargoFlowContract
      .connect(signers.alice)
      .createShipment(trackingId, origin, destination, estimatedDelivery);
    await tx.wait();

    // Try to create duplicate
    await expect(
      secureCargoFlowContract
        .connect(signers.alice)
        .createShipment(trackingId, origin, destination, estimatedDelivery)
    ).to.be.revertedWith("Shipment already exists");
  });

  it("should prevent adding events to non-existent shipments", async function () {
    const trackingId = "CARGO-NONEXISTENT";
    const weightInGrams = 2500000;
    const encryptedWeight = await fhevmInstance
      .createEncryptedInput(secureCargoFlowContractAddress, signers.alice.address)
      .add32(weightInGrams)
      .encrypt();

    // Encrypt contents byte by byte (like SecretBank)
    const contents = "Contents";
    const contentsBytes = new TextEncoder().encode(contents.slice(0, 64)); // Limit to 64 bytes
    const contentsInput = fhevmInstance.createEncryptedInput(secureCargoFlowContractAddress, signers.alice.address);
    for (const b of contentsBytes) {
      contentsInput.add8(b); // Encrypt each byte as euint8
    }
    const encryptedContents = await contentsInput.encrypt();

    await expect(
      secureCargoFlowContract
        .connect(signers.alice)
        .addCargoEvent(
          trackingId,
          "Some Location",
          0,
          encryptedWeight.handles[0],
          encryptedWeight.inputProof,
          encryptedContents.handles, // Array of byte handles
          encryptedContents.inputProof
        )
    ).to.be.revertedWith("Shipment does not exist");
  });

  it("should reject tracking IDs that are too short", async function () {
    const shortTrackingId = "ABC"; // Less than 6 characters
    const origin = "Test Origin";
    const destination = "Test Destination";
    const estimatedDelivery = Math.floor(Date.now() / 1000) + 86400;

    await expect(
      secureCargoFlowContract
        .connect(signers.alice)
        .createShipment(shortTrackingId, origin, destination, estimatedDelivery)
    ).to.be.revertedWith("Tracking ID too short");
  });

  it("should enforce access control for adding cargo events", async function () {
    const trackingId = "CARGO-2024-004";
    const origin = "Shanghai Port";
    const destination = "Los Angeles Port";
    const estimatedDelivery = Math.floor(Date.now() / 1000) + 86400 * 7;

    let tx = await secureCargoFlowContract
      .connect(signers.alice)
      .createShipment(trackingId, origin, destination, estimatedDelivery);
    await tx.wait();

    const weightInGrams = 2500000;
    const encryptedWeight = await fhevmInstance
      .createEncryptedInput(secureCargoFlowContractAddress, signers.bob.address)
      .add32(weightInGrams)
      .encrypt();

    const contents = "Test Contents";
    const contentsBytes = new TextEncoder().encode(contents);
    const contentsInput = fhevmInstance.createEncryptedInput(secureCargoFlowContractAddress, signers.bob.address);
    for (const b of contentsBytes) {
      contentsInput.add8(b);
    }
    const encryptedContents = await contentsInput.encrypt();

    await expect(
      secureCargoFlowContract
        .connect(signers.bob)
        .addCargoEvent(
          trackingId,
          "Test Location",
          0,
          encryptedWeight.handles[0],
          encryptedWeight.inputProof,
          encryptedContents.handles,
          encryptedContents.inputProof
        )
    ).to.be.revertedWith("Only shipment creator can add events");
  });

  it("should allow anyone to add anomaly events", async function () {
    const trackingId = "CARGO-2024-005";
    const origin = "Shanghai Port";
    const destination = "Los Angeles Port";
    const estimatedDelivery = Math.floor(Date.now() / 1000) + 86400 * 7;

    let tx = await secureCargoFlowContract
      .connect(signers.alice)
      .createShipment(trackingId, origin, destination, estimatedDelivery);
    await tx.wait();

    const weightInGrams = 2500000;
    const encryptedWeight = await fhevmInstance
      .createEncryptedInput(secureCargoFlowContractAddress, signers.bob.address)
      .add32(weightInGrams)
      .encrypt();

    const contents = "Test Contents";
    const contentsBytes = new TextEncoder().encode(contents);
    const contentsInput = fhevmInstance.createEncryptedInput(secureCargoFlowContractAddress, signers.bob.address);
    for (const b of contentsBytes) {
      contentsInput.add8(b);
    }
    const encryptedContents = await contentsInput.encrypt();

    tx = await secureCargoFlowContract
      .connect(signers.bob)
      .addCargoEventWithAnomaly(
        trackingId,
        "Test Location",
        1,
        encryptedWeight.handles[0],
        encryptedWeight.inputProof,
        encryptedContents.handles,
        encryptedContents.inputProof,
        "Test anomaly"
      );
    await tx.wait();

    const eventCount = await secureCargoFlowContract.getEventCount(trackingId);
    expect(eventCount).to.eq(1);
  });

  it("should validate shipment existence for queries", async function () {
    const nonExistentTrackingId = "NONEXISTENT-001";

    await expect(
      secureCargoFlowContract.getEventCount(nonExistentTrackingId)
    ).to.be.revertedWith("Shipment does not exist");

    await expect(
      secureCargoFlowContract.getShipment(nonExistentTrackingId)
    ).to.be.revertedWith("Shipment does not exist");
  });

  it("should handle network timeout scenarios gracefully", async function () {
    const trackingId = "CARGO-TIMEOUT-001";
    const origin = "Timeout Test Origin";
    const destination = "Timeout Test Destination";
    const estimatedDelivery = Math.floor(Date.now() / 1000) + 86400 * 7;

    let tx = await secureCargoFlowContract
      .connect(signers.alice)
      .createShipment(trackingId, origin, destination, estimatedDelivery);
    await tx.wait();

    const weightInGrams = 1500000;
    const encryptedWeight = await fhevmInstance
      .createEncryptedInput(secureCargoFlowContractAddress, signers.alice.address)
      .add32(weightInGrams)
      .encrypt();

    const contents = "Timeout Test Contents";
    const contentsBytes = new TextEncoder().encode(contents);
    const contentsInput = fhevmInstance.createEncryptedInput(secureCargoFlowContractAddress, signers.alice.address);
    for (const b of contentsBytes) {
      contentsInput.add8(b);
    }
    const encryptedContents = await contentsInput.encrypt();

    tx = await secureCargoFlowContract
      .connect(signers.alice)
      .addCargoEvent(
        trackingId,
        "Timeout Location",
        2,
        encryptedWeight.handles[0],
        encryptedWeight.inputProof,
        encryptedContents.handles,
        encryptedContents.inputProof,
        { gasLimit: 5000000 }
      );
    await tx.wait();

    const eventCount = await secureCargoFlowContract.getEventCount(trackingId);
    expect(eventCount).to.eq(1);
  });

  it("should validate encrypted data integrity", async function () {
    const trackingId = "CARGO-INTEGRITY-001";
    const origin = "Integrity Test Origin";
    const destination = "Integrity Test Destination";
    const estimatedDelivery = Math.floor(Date.now() / 1000) + 86400 * 7;

    let tx = await secureCargoFlowContract
      .connect(signers.alice)
      .createShipment(trackingId, origin, destination, estimatedDelivery);
    await tx.wait();

    await expect(
      secureCargoFlowContract
        .connect(signers.alice)
        .addCargoEvent(
          trackingId,
          "Corrupted Data Location",
          0,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x00",
          [],
          "0x00"
        )
    ).to.be.revertedWith("Contents cannot be empty");
  });
});


