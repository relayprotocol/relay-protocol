import { L2NetworkConfig } from '@relay-protocol/types'

export const zero: L2NetworkConfig = {
  assets: {
    usdc: '0x6a6394F47DD0BAF794808F2749C09bd4Ee874E70',
    weth: '0xAc98B49576B1C892ba6BFae08fE1BB0d80Cf599c',
  },
  bridges: {
    zksync: {
      l1SharedDefaultBridge: '0xD7f9f54194C633F36CCD5F3da84ad4a1c38cB2cB',
      l2SharedDefaultBridge: '0x954ba8223a6BFEC1Cc3867139243A02BA0Bc66e4',
    },
  },
  chainId: 543210,
  earliestBlock: 0,
  hyperlaneMailbox: '0xd7b351D2dE3495eA259DD10ab4b9300A378Afbf3',
  isTestnet: false,
  isZKsync: true,
  l1ChainId: 1,
  name: 'Zero',
  rpc: ['https://zero.drpc.org'],
  slug: 'zero',
  stack: 'zksync',
}
