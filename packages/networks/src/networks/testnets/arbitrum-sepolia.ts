import { L2NetworkConfig } from '@relay-protocol/types'

export const arbSepolia: L2NetworkConfig = {
  stack: 'arb',
  bridges: {
    arb: {
      arbSys: '0x0000000000000000000000000000000000000064',
      routerGateway: '0x9fDD1C4E4AA24EEc1d913FABea925594a20d43C7',
    },
    cctp: {
      domain: 3n,
      messenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
      transmitter: '0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872',
    },
  },
  chainId: 421614,
  hyperlaneMailbox: '0x598facE78a4302f11E3de0bee1894Da0b2Cb71F8',
  isTestnet: true,
  l1ChainId: 11155111,
  name: 'Arbitrum Sepolia',
  rpc: ['https://sepolia-rollup.arbitrum.io/rpc'],
  slug: 'arbitrum-sepolia',
  assets: {
    udt: '0xeCf77F1D5bB9d40BCc79343DB16ACB86795050fC',
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  },
}
