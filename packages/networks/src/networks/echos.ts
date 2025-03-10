import { L2NetworkConfig } from '@relay-protocol/types'

export const echos: L2NetworkConfig = {
  stack: 'op',
  l1ChainId: 1,
  chainId: 4321,
  isTestnet: false,
  name: 'Echos',
  slug: 'echos',
  hyperlaneMailbox: '', // TODO: Add Hyperlane mailbox address
  bridges: {
    op: {
      messagePasser: '0x4200000000000000000000000000000000000016',
    },
  },
  assets: {
    usdc: '0x9c5e286e1eB95e8BEeE3058bc0CE642B9f798a41',
    weth: '0x4200000000000000000000000000000000000006',
  },
  rpc: process.env.RPC_17777
    ? [process.env.RPC_17777]
    : ['https://api.echos.exchange'],
}
