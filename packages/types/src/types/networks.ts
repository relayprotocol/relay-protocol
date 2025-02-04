export interface NetworkConfig {
  chainId: number | bigint
  l1ChainId?: number | bigint
  name: string
  slug: string
  bridges: {
    cctp?: {
      domain: bigint
      messenger: string
      transmitter: string
    }
    arb?: {
      routerGateway: string
      outbox?: string
      rollup?: string
    }
    op?: {
      portalProxy?: string
      disputeGame?: string
    }
    zksync?: {
      l1SharedDefaultBridge: string
      l2SharedDefaultBridge: string
    }
  }
  rpc?: string
  isZKsync?: boolean
  hyperlaneMailbox: string
  isTestnet: boolean
  assets: NetworkAssets
  uniswapV3?: {
    universalRouterAddress: string
  }
}

interface NetworkAssets {
  [asset: string]: string
}

export interface NetworkConfigs {
  [networkId: string]: NetworkConfig
}
