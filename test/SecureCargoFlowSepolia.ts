import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { SecureCargoFlow } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("SecureCargoFlowSepolia", function () {
  let signers: Signers;
  let secureCargoFlowContract: SecureCargoFlow;
  let secureCargoFlowContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const SecureCargoFlowDeployment = await deployments.get("SecureCargoFlow");
      secureCargoFlowContractAddress = SecureCargoFlowDeployment.address;
      secureCargoFlowContract = await ethers.getContractAt(
        "SecureCargoFlow",
        SecureCargoFlowDeployment.address
      );
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should create shipment and add cargo event with encrypted weight", async function () {
    steps = 12;

    this.timeout(4 * 40000);

    const trackingId = "CARGO-SEPOLIA-001";
    const origin = "Shanghai Port";
    const destination = "Los Angeles Port";
    const estimatedDelivery = Math.floor(Date.now() / 1000) + 86400 * 7;

    progress(`Creating shipment ${trackingId}...`);
    let tx = await secureCargoFlowContract
      .connect(signers.alice)
      .createShipment(trackingId, origin, destination, estimatedDelivery);
    await tx.wait();

    progress(`Encrypting weight (2500 kg = 2500000 grams)...`);
    const weightInGrams = 2500000;
    const encryptedWeight = await fhevm
      .createEncryptedInput(secureCargoFlowContractAddress, signers.alice.address)
      .add32(weightInGrams)
      .encrypt();

    progress(
      `Adding cargo event SecureCargoFlow=${secureCargoFlowContractAddress} handle=${ethers.hexlify(encryptedWeight.handles[0])} signer=${signers.alice.address}...`
    );
    tx = await secureCargoFlowContract
      .connect(signers.alice)
      .addCargoEvent(
        trackingId,
        "Shanghai Port, China",
        0, // ShipmentStatus.Created
        encryptedWeight.handles[0],
        encryptedWeight.inputProof,
        "Electronic Components (Class A)"
      );
    await tx.wait();

    progress(`Getting encrypted weight...`);
    const encryptedWeightHandle = await secureCargoFlowContract.getEncryptedWeight(trackingId, 0);
    expect(encryptedWeightHandle).to.not.eq(ethers.ZeroHash);

    progress(`Decrypting weight...`);
    const decryptedWeight = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedWeightHandle,
      secureCargoFlowContractAddress,
      signers.alice
    );
    progress(`Decrypted weight: ${decryptedWeight} grams (${decryptedWeight / 1000} kg)`);

    expect(decryptedWeight).to.eq(weightInGrams);

    progress(`Getting event count...`);
    const eventCount = await secureCargoFlowContract.getEventCount(trackingId);
    expect(eventCount).to.eq(1);

    progress(`Getting event public data...`);
    const eventPublic = await secureCargoFlowContract.getCargoEventPublic(trackingId, 0);
    expect(eventPublic.location).to.eq("Shanghai Port, China");
    expect(eventPublic.publicContents).to.eq("Electronic Components (Class A)");
  });
});


