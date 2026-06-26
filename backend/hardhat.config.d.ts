import "hardhat/types/runtime";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

declare module "hardhat/types/runtime" {
    interface HardhatRuntimeEnvironment {
        ethers: typeof import("@nomicfoundation/hardhat-ethers").ethers;
        upgrades: typeof import("@openzeppelin/hardhat-upgrades").upgrades;
    }
}
