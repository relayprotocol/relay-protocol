import { ChildNetworkConfig } from '@relay-protocol/types'

export const zero: ChildNetworkConfig = {
  assets: {
    usdc: '0x6a6394F47DD0BAF794808F2749C09bd4Ee874E70',
    weth: '0xAc98B49576B1C892ba6BFae08fE1BB0d80Cf599c',
  },
  baseChainId: 1,
  bridges: {
    zksync: {
      child: {
        sharedDefaultBridge: '0x954ba8223a6BFEC1Cc3867139243A02BA0Bc66e4',
      },
      parent: {
        sharedDefaultBridge: '0xD7f9f54194C633F36CCD5F3da84ad4a1c38cB2cB',
      },
    },
  },
  chainId: 543210,
  earliestBlock: 2173900,
  hyperlaneMailbox: '0xd7b351D2dE3495eA259DD10ab4b9300A378Afbf3',
  isTestnet: false,
  isZKsync: true,
  name: 'Zero',
  rpc: ['https://rpc.zerion.io/v1/zero'],
  slug: 'zero',
  stack: 'zksync',
}
