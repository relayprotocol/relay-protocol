import { L2NetworkConfig } from '@relay-protocol/types'

export const abstract: L2NetworkConfig = {
  stack: 'zksync',
  l1ChainId: 1,
  chainId: 2741,
  isTestnet: false,
  name: 'Abstract',
  slug: 'abstract',
  isZKsync: true,
  hyperlaneMailbox: '0x9BbDf86b272d224323136E15594fdCe487F40ce7',
  bridges: {
    zksync: {
      l1SharedDefaultBridge: '0xD7f9f54194C633F36CCD5F3da84ad4a1c38cB2cB',
      l2SharedDefaultBridge: '0x954ba8223a6BFEC1Cc3867139243A02BA0Bc66e4',
    },
  },
  assets: {
    usdc: '0x84A71ccD554Cc1b02749b35d22F684CC8ec987e1',
    weth: '0x3439153EB7AF838Ad19d56E1571FBD09333C2809',
  },
  rpc: process.env.RPC_18231
    ? [process.env.RPC_18231]
    : ['https://api.mainnet.abs.xyz'],
}
