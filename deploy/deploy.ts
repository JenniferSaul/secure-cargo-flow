import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedSecureCargoFlow = await deploy("SecureCargoFlow", {
    from: deployer,
    log: true,
  });

  console.log(`SecureCargoFlow contract: `, deployedSecureCargoFlow.address);
};
export default func;
func.id = "deploy_secureCargoFlow"; // id required to prevent reexecution
func.tags = ["SecureCargoFlow"];


