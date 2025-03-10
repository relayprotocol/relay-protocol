import { L2NetworkConfig } from '@relay-protocol/types'

export const zero: L2NetworkConfig = {
  stack: 'zksync',
  l1ChainId: 1,
  chainId: 543210,
  isTestnet: false,
  name: 'Zero',
  slug: 'zero',
  isZKsync: true,
  hyperlaneMailbox: '0xd7b351D2dE3495eA259DD10ab4b9300A378Afbf3',
  bridges: {
    zksync: {
      l1SharedDefaultBridge: '0xD7f9f54194C633F36CCD5F3da84ad4a1c38cB2cB',
      l2SharedDefaultBridge: '0x954ba8223a6BFEC1Cc3867139243A02BA0Bc66e4',
    },
  },
  assets: {
    usdc: '0x6a6394F47DD0BAF794808F2749C09bd4Ee874E70',
    weth: '0xAc98B49576B1C892ba6BFae08fE1BB0d80Cf599c',
  },
  rpc: ['https://zero.drpc.org'],
}
