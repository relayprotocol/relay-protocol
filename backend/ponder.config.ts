import { createConfig, factory } from 'ponder'
import { Portal2, Outbox } from '@relay-protocol/helpers/abis'

import {
  RelayPool,
  RelayBridge,
  RelayPoolFactory,
  RelayBridgeFactory,
} from '@relay-protocol/abis'
import { createNetworkConfig } from './src/utils/rpc'
import { Abi, AbiEvent } from 'viem'
import { getAddresses } from '@relay-protocol/addresses'
import networks from '@relay-protocol/networks'

const deployedAddresses = getAddresses()

const earliestBlocks = {
  arbSepolia: 115000000,
  baseSepolia: 21000000,
  opSepolia: 22000000,
  sepolia: 7500000,
}

const usedNetworks = Object.keys(networks).reduce((usedNetworks, chainId) => {
  return {
    ...usedNetworks,
    [networks[chainId].name]: createNetworkConfig(chainId!),
  }
}, {})

export default createConfig({
  blocks: {
    VaultSnapshot: {
      interval: 25,
      network: 'sepolia', // ~5 minutes with 12s block time
      startBlock: earliestBlocks.sepolia,
    },
  },
  contracts: {
    // Third-party contracts
    OPPortal: {
      abi: Portal2,
      network: {
        sepolia: {
          address: [
            networks['11155111']!.bridges!.op!.portalProxy! as `0x${string}`,
            networks['11155111']!.bridges!.base!.portalProxy! as `0x${string}`,
          ],
          startBlock: earliestBlocks.sepolia,
        },
      },
    },
    OrbitOutbox: {
      abi: Outbox,
      network: {
        sepolia: {
          address: networks['11155111']!.bridges!.arb!.outbox! as `0x${string}`,
          startBlock: earliestBlocks.sepolia,
        },
      },
    },

    RelayBridge: {
      abi: RelayBridge as Abi,
      network: {
        arbSepolia: {
          address: factory({
            address: deployedAddresses['421614'].RelayBridgeFactory,
            event: RelayBridgeFactory.find(
              (e) => e.name === 'BridgeDeployed'
            ) as AbiEvent,
            parameter: 'bridge',
          }),
          startBlock: earliestBlocks.arbSepolia,
        },
        baseSepolia: {
          address: factory({
            address: deployedAddresses['84532'].RelayBridgeFactory,
            event: RelayBridgeFactory.find(
              (e) => e.name === 'BridgeDeployed'
            ) as AbiEvent,
            parameter: 'bridge',
          }),
          startBlock: earliestBlocks.baseSepolia,
        },
        opSepolia: {
          address: factory({
            address: deployedAddresses['11155420'].RelayBridgeFactory,
            event: RelayBridgeFactory.find(
              (e) => e.name === 'BridgeDeployed'
            ) as AbiEvent,
            parameter: 'bridge',
          }),
          startBlock: earliestBlocks.opSepolia,
        },
      },
    },
    RelayBridgeFactory: {
      abi: RelayBridgeFactory as Abi,
      network: {
        arbSepolia: {
          address: deployedAddresses['421614'].RelayBridgeFactory,
          startBlock: earliestBlocks.arbSepolia,
        },
        baseSepolia: {
          address: deployedAddresses['84532'].RelayBridgeFactory,
          startBlock: earliestBlocks.baseSepolia,
        },
        opSepolia: {
          address: deployedAddresses['11155420'].RelayBridgeFactory,
          startBlock: earliestBlocks.opSepolia,
        },
      },
    },
    RelayPool: {
      abi: RelayPool as Abi,
      address: factory({
        address: deployedAddresses['11155111'].RelayPoolFactory,
        event: RelayPoolFactory.find(
          (e) => e.name === 'PoolDeployed'
        ) as AbiEvent,
        parameter: 'pool',
        startBlock: earliestBlocks.sepolia,
      }),
      network: 'sepolia',
    },
    // Relay contracts
    RelayPoolFactory: {
      abi: RelayPoolFactory as Abi,
      network: {
        sepolia: {
          address: deployedAddresses['11155111'].RelayPoolFactory,
          startBlock: earliestBlocks.sepolia,
        },
      },
    },
  },
  database: {
    connectionString: process.env.DATABASE_URL,
    kind: 'postgres',
  },
  networks: usedNetworks,
})
