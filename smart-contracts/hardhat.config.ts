import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-ignition-ethers'
import '@matterlabs/hardhat-zksync'
import { networks as nets } from '@relay-protocol/networks'
import registry from '@hyperlane-xyz/registry'
import 'solidity-docgen'

// Interracting
import './tasks/pool'
import './tasks/bridge'
import './tasks/origins/add'

// Actual contracts
import './tasks/deploy/pool'
import './tasks/deploy/relay-bridge'
import './tasks/deploy/bridge-proxy'
import './tasks/deploy/relay-pool-factory'
import './tasks/deploy/relay-bridge-factory'
import './tasks/deploy/verify'
import './tasks/deploy/timelock'
import './tasks/deploy/set-earliest-block'

// Helpers/tests
import './tasks/networks'
import './tasks/deploy/native-gateway'
import './tasks/deploy/dummy-yield-pool'
import './tasks/utils/exportAbis'
import './tasks/utils/zksync-contracts.ts'
import './tasks/utils/collect-morpho.ts'

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
  const { slug, rpc, isTestnet, stack } = nets[id]
  let accounts
  let zksync = {}
  const network = {
    chainId: Number(id),
    url: rpc[0],
  }
  if (DEPLOYER_PRIVATE_KEY) {
    accounts = [DEPLOYER_PRIVATE_KEY]
  }
  if (stack === 'zksync') {
    zksync = {
      ethNetwork: isTestnet ? 'sepolia' : 'mainnet',
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
    abstract: 'UU3TIIASIBJ6GZ5NIHG2T5QDY2PVUGTCMI',
    arbitrumOne: 'W5XNFPZS8D6JZ5AXVWD4XCG8B5ZH5JCD4Y',
    arbitrumSepolia: 'W5XNFPZS8D6JZ5AXVWD4XCG8B5ZH5JCD4Y',
    avalanche: 'N4AF8AYN8PXY2MFPUT8PAFSZNVJX5Q814X',
    base: 'F9E5R4E8HIJQZMRE9U9IZMP7NVZ2IAXNB8',
    baseSepolia: 'F9E5R4E8HIJQZMRE9U9IZMP7NVZ2IAXNB8',
    bsc: '6YUDRP3TFPQNRGGZQNYAEI1UI17NK96XGK',
    ethereum: 'C1KDFD2PHN7FXXXT1AW5PG27I5JB23J41D',
    'ethereum sepolia': 'HPSH1KQDPJTNAPU3335G931SC6Y3ZYK3BF',
    gnosis: 'BSW3C3NDUUBWSQZJ5FUXBNXVYX92HZDDCV',
    mainnet: 'C1KDFD2PHN7FXXXT1AW5PG27I5JB23J41D',
    optimisticEthereum: 'V51DWC44XURIGPP49X85VZQGH1DCBAW5EC',
    polygon: 'W9TVEYKW2CDTQ94T3A2V93IX6U3IHQN5Y3',
    polygonZkEVM: '8H4ZB9SQBMQ7WA1TCIXFQVCHTVX8DXTY9Y',
    sepolia: 'HPSH1KQDPJTNAPU3335G931SC6Y3ZYK3BF',
    swellchain: 'default-api-key',
    xdai: 'BSW3C3NDUUBWSQZJ5FUXBNXVYX92HZDDCV',
    zero: 'default-api-key',
    zora: 'default-api-key',
  },
  customChains: [
    {
      chainId: 543210,
      network: 'zero',
      urls: {
        apiURL: 'https://explorer.zero.network/api',
        browserURL: 'https://explorer.zero.network',
      },
    },
  ],
}

Object.values(registry).forEach((v) => {
  // prevent overriding chains declared in customChains array
  const customChain = etherscan.customChains.find(
    ({ chainId }) => chainId === v.chainId
  )
  if (nets[v.chainId] && !customChain) {
    etherscan.apiKey[v.name] = etherscan.apiKey[v.name] || 'default-api-key' // placeholder for blocksncout specifically!
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
  docgen: {
    exclude: ['interfaces', 'utils'],
    pages: 'files',
  },
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
        'contracts/RelayPool.sol',
        'contracts/RelayBridgeFactory.sol',
        'contracts/BridgeProxy/ZkSyncBridgeProxy.sol',
        'contracts/interfaces/IUSDC.sol',
        'contracts/utils/tests/MyToken.sol',
      ],
      // for '<address payable>.send/transfer(<X>)'
      // contracts/RelayBridge.sol:189:5
      suppressedErrors: ['sendtransfer'],
    },
  },
  zksyncAnvil: {
    version: '0.6.1',
  },
}

export default config
