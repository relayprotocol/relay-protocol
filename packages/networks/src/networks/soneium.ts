import { L2NetworkConfig } from '@relay-protocol/types'

export const soneium: L2NetworkConfig = {
  stack: 'op',
  l1ChainId: 1,
  chainId: 1868,
  isTestnet: false,
  name: 'Soneium',
  slug: 'soneium',
  hyperlaneMailbox: '0x3a464f746D23Ab22155710f44dB16dcA53e0775E',
  bridges: {
    op: {
      messagePasser: '0x4200000000000000000000000000000000000016',
    },
  },
  assets: {
    usdc: '', // TODO: Add USDC address
    weth: '0x4200000000000000000000000000000000000006',
  },
  rpc: ['https://rpc.soneium.org'],
}
