import { L1NetworkConfig } from '@relay-protocol/types'

export const ethereum: L1NetworkConfig = {
  assets: {
    udt: '0x90DE74265a416e1393A450752175AED98fe11517',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  bridges: {
    arb: {
      outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
      rollup: '0x5eF0D09d1E6204141B4d37530808eD19f60FBa35',
      routerGateway: '0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef',
    },
    base: {
      disputeGame: '0x43edB88C4B80fDD2AdFF2412A7BebF9dF42cB40e',
      portalProxy: '0x49048044D57e1C92A77f79988d21Fa8fAF74E97e',
    },
    cctp: {
      domain: 0n,
      messenger: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
      transmitter: '0x0a992d191DEeC32aFe36203Ad87D7d289a738F81',
    },
    lisk: {
      // disputeGame: '0x0479e6757eb4743843b309DDDF78E6bA242F38BE',
      portalProxy: '0x26dB93F8b8b4f7016240af62F7730979d353f9A7',
    },
    op: {
      disputeGame: '0xe5965Ab5962eDc7477C8520243A95517CD252fA9',
      portalProxy: '0xbEb5Fc579115071764c7423A4f12eDde41f106Ed',
    },
    zksync: {
      l1SharedDefaultBridge: '0xD7f9f54194C633F36CCD5F3da84ad4a1c38cB2cB',
      l2SharedDefaultBridge: '0x11f943b2c77b743AB90f4A0Ae7d5A4e7FCA3E102',
    },
  },
  chainId: 1,
  earliestBlock: 22000000,
  hyperlaneMailbox: '0xc005dc82818d67AF737725bD4bf75435d065D239',
  isTestnet: false,
  name: 'Ethereum',
  rpc: process.env.RPC_1
    ? [process.env.RPC_1]
    : ['https://mainnet.gateway.tenderly.co'],
  slug: 'ethereum',
  uniswapV3: {
    universalRouterAddress: '0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B',
  },
}
