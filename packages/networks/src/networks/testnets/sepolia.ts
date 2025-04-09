import { L1NetworkConfig } from '@relay-protocol/types'

export const sepolia: L1NetworkConfig = {
  assets: {
    udt: '0x4C38B5Dcc47c4990363F22bFeb2add741123914F',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    weth: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
  },
  bridges: {
    arb: {
      outbox: '0x65f07C7D521164a4d5DaC6eB8Fac8DA067A3B78F',
      rollup: '0x042B2E6C5E99d4c521bd49beeD5E99651D9B0Cf4',
      routerGateway: '0xcE18836b233C83325Cc8848CA4487e94C6288264',
    },
    base: {
      portalProxy: '0x49f53e41452C74589E85cA1677426Ba426459e85',
    },
    cctp: {
      domain: 0n,
      messenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
      transmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    },
    op: {
      portalProxy: '0x16Fc5058F25648194471939df75CF27A2fdC48BC',
    },
    zksync: {
      l1SharedDefaultBridge: '0x3E8b2fe58675126ed30d0d12dea2A9bda72D18Ae',
      l2SharedDefaultBridge: '0x681A1AFdC2e06776816386500D2D461a6C96cB45',
    },
  },
  chainId: 11155111,
  earliestBlock: 7900000,
  hyperlaneMailbox: '0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766',
  isTestnet: true,

  name: 'Ethereum Sepolia',

  rpc: process.env.RPC_11155111
    ? [process.env.RPC_11155111]
    : ['https://sepolia.gateway.tenderly.co'],
  slug: 'sepolia',
  uniswapV3: {
    universalRouterAddress: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  },
}
