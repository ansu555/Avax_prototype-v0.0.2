import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from 'dotenv'

dotenv.config({ path: process.cwd() + '/.env.local' })

const FUJI_RPC = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc'
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001'

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.21",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    fuji: {
      url: FUJI_RPC,
      accounts: [PRIVATE_KEY]
    }
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  }
};

export default config;
