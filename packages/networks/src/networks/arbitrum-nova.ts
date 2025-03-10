import { L2NetworkConfig } from '@relay-protocol/types'

export const arbitrumNova: L2NetworkConfig = {
  stack: 'arb',
  l1ChainId: 1,
  chainId: 42170,
  isTestnet: false,
  name: 'Arbitrum Nova',
  slug: 'arb-nova',
  hyperlaneMailbox: '0x3a867fCfFeC2B790970eeBDC9023E75B0a172aa7',
  bridges: {
    arb: {
      arbSys: '0x0000000000000000000000000000000000000064',
      routerGateway: '', // TODO: Add router gateway address
    },
  },
  assets: {
    usdc: '0x750ba8b76187092B0D1E87E28daaf484d1b5273b',
    weth: '0x765277EebeCA2e31912C9946eAe1021199B39C61',
  },
  rpc: process.env.RPC_42170
    ? [process.env.RPC_42170]
    : ['https://nova.arbitrum.io/rpc'],
}
