import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-ignition-ethers'
import { networks as nets } from '@relay-protocol/networks'
import '@matterlabs/hardhat-zksync'

// Interracting
import './tasks/pool'
import './tasks/bridge'
import './tasks/claim/cctp'
import './tasks/claim/arb'
import './tasks/claim/native'
import './tasks/claim/zksync'
import './tasks/origins/add'

// Actual contracts
import './tasks/deploy/pool'
import './tasks/deploy/relay-bridge'
import './tasks/deploy/bridge-proxy'
import './tasks/deploy/relay-pool-factory'
import './tasks/deploy/relay-bridge-factory'
import './tasks/deploy/timelock'
import './tasks/deploy/verify'

// Helpers/tests
import './tasks/networks'
import './tasks/deploy/native-gateway'
import './tasks/deploy/dummy-yield-pool'
import './tasks/utils/exportAbis'

// get pk from shell
const { DEPLOYER_PRIVATE_KEY } = process.env
if (!DEPLOYER_PRIVATE_KEY) {
  console.error(
    '⚠️ Missing DEPLOYER_PRIVATE_KEY environment variable. Please set one. In the meantime, we will use default settings'
  )
} else {
  console.error(
    '⚠️ Using account from DEPLOYER_PRIVATE_KEY environment variable.'
  )
}

// parse networks from file
const networks = { hardhat: {} }
Object.keys(nets).forEach((id) => {
  const { slug, rpc, isTestnet, isZKsync } = nets[id]
  let accounts
  let zksync = {}
  const network = {
    url: rpc[0],
    chainId: Number(id),
  }
  if (DEPLOYER_PRIVATE_KEY) {
    accounts = [DEPLOYER_PRIVATE_KEY]
  }
  if (isZKsync) {
    zksync = {
      zksync: true,
      ethNetwork: isTestnet ? 'sepolia' : 'mainnet',
      verifyURL: isTestnet
        ? 'https://explorer.sepolia.era.zksync.dev/contract_verification'
        : 'https://zksync2-mainnet-explorer.zksync.io/contract_verification',
    }
  }
  networks[slug] = {
    ...network,
    accounts,
    ...zksync,
  }
})

// parse fork URL for tests
const forkUrl = process.env.RPC_URL
if (forkUrl) {
  networks.hardhat = {
    forking: {
      url: forkUrl,
    },
  }
}

const etherscan = {
  apiKey: {
    // xdai requires only placeholder api key
    polygon: 'W9TVEYKW2CDTQ94T3A2V93IX6U3IHQN5Y3',
    mainnet: 'HPSH1KQDPJTNAPU3335G931SC6Y3ZYK3BF',
    sepolia: 'HPSH1KQDPJTNAPU3335G931SC6Y3ZYK3BF',
    bsc: '6YUDRP3TFPQNRGGZQNYAEI1UI17NK96XGK',
    gnosis: 'BSW3C3NDUUBWSQZJ5FUXBNXVYX92HZDDCV',
    xdai: 'BSW3C3NDUUBWSQZJ5FUXBNXVYX92HZDDCV',
    optimisticEthereum: 'V51DWC44XURIGPP49X85VZQGH1DCBAW5EC',
    arbitrumOne: 'W5XNFPZS8D6JZ5AXVWD4XCG8B5ZH5JCD4Y',
    avalanche: 'N4AF8AYN8PXY2MFPUT8PAFSZNVJX5Q814X',
    celo: '6KBKUFYV3NQR4Y1BQN3Q34S2U7NTZBBPQZ',
    base: 'F9E5R4E8HIJQZMRE9U9IZMP7NVZ2IAXNB8',
    baseSepolia: 'F9E5R4E8HIJQZMRE9U9IZMP7NVZ2IAXNB8',
    linea: 'S66J314Q7PICPB4RP2G117KDFQRBEUYIFX',
    polygonZkEVM: '8H4ZB9SQBMQ7WA1TCIXFQVCHTVX8DXTY9Y',
    scroll: 'BZEXNPN6KKKJQ8VIMNXZDZNEX7QQZWZQ3P',
    opSepolia: 'V51DWC44XURIGPP49X85VZQGH1DCBAW5EC',
    'arbitrum-sepolia': 'W5XNFPZS8D6JZ5AXVWD4XCG8B5ZH5JCD4Y',
    zksyncsepolia: '9RJM97KMNID76WJQZD7SFB5QE7Q1342ANF',
    zksyncmainnet: '9RJM97KMNID76WJQZD7SFB5QE7Q1342ANF',
  },
  customChains: [
    {
      network: 'baseSepolia',
      chainId: 84532,
      urls: {
        apiURL: 'https://api-sepolia.basescan.org/api',
        browserURL: 'https://sepolia.basescan.org/',
      },
    },
    {
      network: 'opSepolia',
      chainId: 11155420,
      urls: {
        apiURL: 'https://api-sepolia-optimism.etherscan.io/api',
        browserURL: 'https://sepolia-optimism.etherscan.io/',
      },
    },
    {
      network: 'base',
      chainId: 8453,
      urls: {
        apiURL: 'https://api.basescan.org/api',
        browserURL: 'https://basescan.org/',
      },
    },
    {
      network: 'arbitrum-sepolia',
      chainId: 421614,
      urls: {
        apiURL: 'https://api-sepolia.arbiscan.io/api',
        browserURL: 'https://sepolia.arbiscan.io/',
      },
    },
  ],
}

const config: HardhatUserConfig = {
  networks,
  etherscan,
  sourcify: {
    enabled: false,
  },
  solidity: {
    compilers: [
      {
        version: '0.8.28',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: { yul: false },
          },
        },
      },
    ],
  },
}

export default config
