import { L2NetworkConfig } from '@relay-protocol/types'

export const zkSyncSepolia: L2NetworkConfig = {
  assets: {
    usdc: '0xAe045DE5638162fa134807Cb558E15A3F5A7F853',
    weth: '0x2D6Db36B3117802E996f13073A08A685D3FeF7eD',
  },
  bridges: {
    zksync: {
      l1SharedDefaultBridge: '0x3E8b2fe58675126ed30d0d12dea2A9bda72D18Ae',
      l2SharedDefaultBridge: '0x681A1AFdC2e06776816386500D2D461a6C96cB45',
    },
  },
  chainId: 300,
  earliestBlock: 0,
  hyperlaneMailbox: '0x1E45f767d51FA1Ec326d35e3BD4904fF0f30fCDa',
  isTestnet: true,
  isZKsync: true,
  l1ChainId: 11155111,
  name: 'ZKsync Sepolia Testnet',
  rpc: process.env.RPC_300
    ? [process.env.RPC_300]
    : ['https://sepolia.era.zksync.dev'],
  slug: 'zksync-sepolia',
  stack: 'zksync',
}
