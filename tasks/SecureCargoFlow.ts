import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact Locally (--network localhost)
 * ===========================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the SecureCargoFlow contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the SecureCargoFlow contract
 *
 *   npx hardhat --network localhost task:create-shipment --trackingId CARGO-001 --origin "Shanghai Port" --destination "Los Angeles Port"
 *   npx hardhat --network localhost task:add-event --trackingId CARGO-001 --location "Shanghai Port, China" --weight 2500
 *   npx hardhat --network localhost task:decrypt-weight --trackingId CARGO-001 --eventIndex 0
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ===========================================================
 *
 * 1. Deploy the SecureCargoFlow contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the SecureCargoFlow contract
 *
 *   npx hardhat --network sepolia task:create-shipment --trackingId CARGO-001 --origin "Shanghai Port" --destination "Los Angeles Port"
 *   npx hardhat --network sepolia task:add-event --trackingId CARGO-001 --location "Shanghai Port, China" --weight 2500
 *   npx hardhat --network sepolia task:decrypt-weight --trackingId CARGO-001 --eventIndex 0
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost task:address
 *   - npx hardhat --network sepolia task:address
 */
task("task:address", "Prints the SecureCargoFlow address").setAction(
  async function (_taskArguments: TaskArguments, hre) {
    const { deployments, getChainId } = hre;

    const chainId = await getChainId();
    const secureCargoFlow = await deployments.get("SecureCargoFlow");

    console.log(`Network Chain ID: ${chainId}`);
    console.log(`SecureCargoFlow contract address: ${secureCargoFlow.address}`);
  }
);

/**
 * Example:
 *   - npx hardhat --network localhost task:create-shipment --trackingId CARGO-001 --origin "Shanghai Port" --destination "Los Angeles Port"
 */
task("task:create-shipment", "Creates a new shipment")
  .addOptionalParam("address", "Optionally specify the SecureCargoFlow contract address")
  .addParam("trackingId", "Tracking ID for the shipment")
  .addParam("origin", "Origin location")
  .addParam("destination", "Destination location")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const SecureCargoFlowDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SecureCargoFlow");
    console.log(`SecureCargoFlow: ${SecureCargoFlowDeployment.address}`);

    const signers = await ethers.getSigners();
    const secureCargoFlowContract = await ethers.getContractAt(
      "SecureCargoFlow",
      SecureCargoFlowDeployment.address
    );

    const estimatedDelivery = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days from now

    const tx = await secureCargoFlowContract
      .connect(signers[0])
      .createShipment(
        taskArguments.trackingId,
        taskArguments.origin,
        taskArguments.destination,
        estimatedDelivery
      );
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`Shipment ${taskArguments.trackingId} created successfully!`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:add-event --trackingId CARGO-001 --location "Shanghai Port, China" --weight 2500
 */
task("task:add-event", "Adds a cargo event with encrypted weight")
  .addOptionalParam("address", "Optionally specify the SecureCargoFlow contract address")
  .addParam("trackingId", "Tracking ID for the shipment")
  .addParam("location", "Event location")
  .addParam("weight", "Weight in kg (will be encrypted)")
  .addOptionalParam("status", "Shipment status (0=Created, 1=InTransit, 2=CustomsClearance, 3=Arrived, 4=Delivered)", "0")
  .addOptionalParam("contents", "Public contents description", "Electronic Components")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const weightInKg = parseFloat(taskArguments.weight);
    if (isNaN(weightInKg)) {
      throw new Error(`Argument --weight is not a number`);
    }

    await fhevm.initializeCLIApi();

    const SecureCargoFlowDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SecureCargoFlow");
    console.log(`SecureCargoFlow: ${SecureCargoFlowDeployment.address}`);

    const signers = await ethers.getSigners();
    const secureCargoFlowContract = await ethers.getContractAt(
      "SecureCargoFlow",
      SecureCargoFlowDeployment.address
    );

    // Convert kg to grams and encrypt
    const weightInGrams = Math.floor(weightInKg * 1000);
    const encryptedWeight = await fhevm
      .createEncryptedInput(SecureCargoFlowDeployment.address, signers[0].address)
      .add32(weightInGrams)
      .encrypt();

    const status = parseInt(taskArguments.status || "0");

    const tx = await secureCargoFlowContract
      .connect(signers[0])
      .addCargoEvent(
        taskArguments.trackingId,
        taskArguments.location,
        status,
        encryptedWeight.handles[0],
        encryptedWeight.inputProof,
        taskArguments.contents || "Electronic Components"
      );
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`Cargo event added successfully!`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:decrypt-weight --trackingId CARGO-001 --eventIndex 0
 */
task("task:decrypt-weight", "Decrypts the weight for a cargo event")
  .addOptionalParam("address", "Optionally specify the SecureCargoFlow contract address")
  .addParam("trackingId", "Tracking ID for the shipment")
  .addParam("eventIndex", "Event index to decrypt")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const SecureCargoFlowDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SecureCargoFlow");
    console.log(`SecureCargoFlow: ${SecureCargoFlowDeployment.address}`);

    const signers = await ethers.getSigners();
    const secureCargoFlowContract = await ethers.getContractAt(
      "SecureCargoFlow",
      SecureCargoFlowDeployment.address
    );

    const eventIndex = parseInt(taskArguments.eventIndex);
    if (isNaN(eventIndex)) {
      throw new Error(`Argument --eventIndex is not a number`);
    }

    const encryptedWeight = await secureCargoFlowContract.getEncryptedWeight(
      taskArguments.trackingId,
      eventIndex
    );

    if (encryptedWeight === ethers.ZeroHash) {
      console.log(`Encrypted weight: ${encryptedWeight}`);
      console.log("Clear weight: 0 kg");
      return;
    }

    const decryptedWeightGrams = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedWeight,
      SecureCargoFlowDeployment.address,
      signers[0]
    );

    const decryptedWeightKg = decryptedWeightGrams / 1000;
    console.log(`Encrypted weight: ${encryptedWeight}`);
    console.log(`Clear weight: ${decryptedWeightGrams} grams (${decryptedWeightKg} kg)`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:check-events --trackingId CARGO-2024-DEMO-001
 */
task("task:check-events", "Checks cargo events for a shipment")
  .addOptionalParam("address", "Optionally specify the SecureCargoFlow contract address")
  .addParam("trackingId", "Tracking ID for the shipment")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const SecureCargoFlowDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SecureCargoFlow");
    console.log(`SecureCargoFlow: ${SecureCargoFlowDeployment.address}`);

    const signers = await ethers.getSigners();
    const secureCargoFlowContract = await ethers.getContractAt(
      "SecureCargoFlow",
      SecureCargoFlowDeployment.address
    );

    // Check if shipment exists
    try {
      const shipment = await secureCargoFlowContract.getShipment(taskArguments.trackingId);
      console.log(`\nShipment found:`);
      console.log(`  Tracking ID: ${shipment.trackingId}`);
      console.log(`  Origin: ${shipment.origin}`);
      console.log(`  Destination: ${shipment.destination}`);
      console.log(`  Creator: ${shipment.creator}`);
      console.log(`  Created at: ${new Date(Number(shipment.createdAt) * 1000).toLocaleString()}`);
      console.log(`  Exists: ${shipment.exists}`);
      
      // Get event count
      const eventCount = await secureCargoFlowContract.getEventCount(taskArguments.trackingId);
      console.log(`\nEvent count: ${eventCount}`);
      
      if (eventCount > 0) {
        console.log(`\nEvents:`);
        for (let i = 0; i < eventCount; i++) {
          const eventPublic = await secureCargoFlowContract.getCargoEventPublic(
            taskArguments.trackingId,
            i
          );
          console.log(`\n  Event ${i}:`);
          console.log(`    Event ID: ${eventPublic.eventId}`);
          console.log(`    Location: ${eventPublic.location}`);
          console.log(`    Status: ${eventPublic.status}`);
          console.log(`    Contents: ${eventPublic.publicContents}`);
          console.log(`    Timestamp: ${new Date(Number(eventPublic.timestamp) * 1000).toLocaleString()}`);
          console.log(`    Has Anomaly: ${eventPublic.hasAnomaly}`);
          if (eventPublic.hasAnomaly) {
            console.log(`    Anomaly: ${eventPublic.anomalyDescription}`);
          }
        }
      } else {
        console.log(`\n⚠️  No events found for this shipment.`);
        console.log(`   Try adding an event with: npx hardhat --network localhost task:add-event ...`);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error}`);
      console.log(`\nShipment may not exist. Create it first with:`);
      console.log(`  npx hardhat --network localhost task:create-shipment --trackingId ${taskArguments.trackingId} --origin "Origin" --destination "Destination"`);
    }
  });

