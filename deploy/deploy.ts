import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const chainId = await hre.getChainId();
  console.log(`Deploying to network with chainId: ${chainId}`);

  const deployedSecureCargoFlow = await deploy("SecureCargoFlow", {
    from: deployer,
    log: true,
    args: [],
  });

  console.log(`SecureCargoFlow contract deployed at: ${deployedSecureCargoFlow.address}`);

  if (chainId === "31337") {
    console.log("Local Hardhat network detected - contracts ready for testing");
  } else if (chainId === "11155111") {
    console.log("Sepolia testnet detected - ensure FHEVM configuration is correct");
  }
};
export default func;
func.id = "deploy_secureCargoFlow"; // id required to prevent reexecution
func.tags = ["SecureCargoFlow"];


