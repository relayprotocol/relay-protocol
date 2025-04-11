import { L2NetworkConfig } from '@relay-protocol/types'

export const arbitrumNova: L2NetworkConfig = {
  assets: {
    usdc: '0x750ba8b76187092B0D1E87E28daaf484d1b5273b',
    weth: '0x765277EebeCA2e31912C9946eAe1021199B39C61',
  },
  bridges: {
    arbitrum: {
      l1: {
        outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
        rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
        routerGateway: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
      },
      l2: {
        arbSys: '0x0000000000000000000000000000000000000064',
        routerGateway: '0x21903d3F8176b1a0c17E953Cd896610Be9fFDFa8',
      },
    },
  },
  chainId: 42170,
  earliestBlock: 83282400,
  hyperlaneMailbox: '0x3a867fCfFeC2B790970eeBDC9023E75B0a172aa7',
  isTestnet: false,
  l1ChainId: 1,
  name: 'Arbitrum Nova',
  rpc: process.env.RPC_42170
    ? [process.env.RPC_42170]
    : ['https://nova.arbitrum.io/rpc'],
  slug: 'arb-nova',
  stack: 'arbitrum',
}
