import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-ignition-ethers'
import { networks as nets } from '@relay-protocol/networks'
import '@matterlabs/hardhat-zksync'
import registry from '@hyperlane-xyz/registry'

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
import './tasks/deploy/verify'
import './tasks/deploy/timelock'

// Helpers/tests
import './tasks/networks'
import './tasks/deploy/native-gateway'
import './tasks/deploy/dummy-yield-pool'
import './tasks/utils/exportAbis'
import './tasks/utils/zksync-contracts.ts'

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
    chainId: Number(id),
    url: rpc[0],
  }
  if (DEPLOYER_PRIVATE_KEY) {
    accounts = [DEPLOYER_PRIVATE_KEY]
  }
  if (isZKsync) {
    zksync = {
      ethNetwork: isTestnet ? 'sepolia' : 'mainnet',
      verifyURL: isTestnet
        ? 'https://explorer.sepolia.era.zksync.dev/contract_verification'
        : 'https://zksync2-mainnet-explorer.zksync.io/contract_verification',
      zksync: true,
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
  // check if fork is zksync
  const isZKsync = !!process.env.ZKSYNC
  networks.hardhat = {
    forking: {
      url: forkUrl,
    },
    zksync: isZKsync,
  }
}

const etherscan = {
  apiKey: {
    arbitrumOne: 'W5XNFPZS8D6JZ5AXVWD4XCG8B5ZH5JCD4Y',
    arbitrumSepolia: 'W5XNFPZS8D6JZ5AXVWD4XCG8B5ZH5JCD4Y',
    avalanche: 'N4AF8AYN8PXY2MFPUT8PAFSZNVJX5Q814X',
    base: 'F9E5R4E8HIJQZMRE9U9IZMP7NVZ2IAXNB8',
    baseSepolia: 'F9E5R4E8HIJQZMRE9U9IZMP7NVZ2IAXNB8',
    bsc: '6YUDRP3TFPQNRGGZQNYAEI1UI17NK96XGK',
    'ethereum sepolia': 'HPSH1KQDPJTNAPU3335G931SC6Y3ZYK3BF',
    gnosis: 'BSW3C3NDUUBWSQZJ5FUXBNXVYX92HZDDCV',
    mainnet: 'HPSH1KQDPJTNAPU3335G931SC6Y3ZYK3BF',
    optimisticEthereum: 'V51DWC44XURIGPP49X85VZQGH1DCBAW5EC',
    polygon: 'W9TVEYKW2CDTQ94T3A2V93IX6U3IHQN5Y3',
    polygonZkEVM: '8H4ZB9SQBMQ7WA1TCIXFQVCHTVX8DXTY9Y',
    sepolia: 'HPSH1KQDPJTNAPU3335G931SC6Y3ZYK3BF',
    xdai: 'BSW3C3NDUUBWSQZJ5FUXBNXVYX92HZDDCV',
  },
  customChains: [],
}

Object.values(registry).forEach((v) => {
  if (nets[v.chainId] && !etherscan.apiKey[v.name]) {
    etherscan.apiKey[v.name] = 'hello' // placeholder for blocksncout specifically!
    etherscan.customChains.push({
      chainId: v.chainId,
      network: v.name,
      urls: {
        apiURL: v.blockExplorers[0].apiUrl.replace('/eth-rpc', ''),
        browserURL: v.blockExplorers[0].url,
      },
    })
  }
})

const config: HardhatUserConfig = {
  etherscan,
  networks,
  solidity: {
    compilers: [
      {
        settings: {
          optimizer: {
            details: { yul: false },
            enabled: true,
            runs: 200,
          },
        },
        version: '0.8.28',
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  zksolc: {
    settings: {
      contractsToCompile: [
        'contracts/BridgeProxy/ZkSyncBridgeProxy.sol',
        'contracts/interfaces/IUSDC.sol',
      ],
      // for '<address payable>.send/transfer(<X>)'
      // contracts/RelayBridge.sol:189:5
      suppressedErrors: ['sendtransfer'],
    },
  },
}

export default config
