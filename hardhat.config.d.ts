import "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

declare module "hardhat/config" {
    interface HardhatRuntimeEnvironment {
        ethers: typeof import("@nomicfoundation/hardhat-ethers").ethers;
        upgrades: typeof import("@openzeppelin/hardhat-upgrades").upgrades;
    }
}
