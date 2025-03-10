import { L2NetworkConfig } from '@relay-protocol/types'

export const b3: L2NetworkConfig = {
  stack: 'op',
  l1ChainId: 1,
  chainId: 8333,
  isTestnet: false,
  name: 'B3',
  slug: 'b3',
  hyperlaneMailbox: '0x3a867fCfFeC2B790970eeBDC9023E75B0a172aa7',
  bridges: {
    op: {
      messagePasser: '0x4200000000000000000000000000000000000016',
    },
  },
  assets: {
    usdc: '', // TODO: Add USDC address
    weth: '0x4200000000000000000000000000000000000006',
  },
  rpc: process.env.RPC_84531
    ? [process.env.RPC_84531]
    : ['https://mainnet-rpc.b3.fun'],
}
