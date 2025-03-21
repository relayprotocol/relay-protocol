export interface L1NetworkConfig extends NetworkConfig {
  uniswapV3: {
    universalRouterAddress: string
  }
}

export interface L2NetworkConfig extends NetworkConfig {
  l1ChainId: number | bigint
  stack: 'op' | 'arb' | 'zksync'
}

export interface NetworkConfig {
  chainId: number | bigint
  name: string
  slug: string
  earliestBlock: number
  bridges: {
    cctp?: {
      domain: bigint
      messenger: string
      transmitter: string
    }
    arb?: {
      arbSys?: string
      routerGateway: string
      outbox?: string
      rollup?: string
    }
    op?: {
      portalProxy?: string
      disputeGame?: string
      messagePasser?: string
    }
    base?: {
      portalProxy?: string
      disputeGame?: string
      messagePasser?: string
    }
    zksync?: {
      l1SharedDefaultBridge: string
      l2SharedDefaultBridge: string
    }
  }
  isZKsync?: boolean
  hyperlaneMailbox: string
  hyperlaneHook?: string // TODO: combine with mailbox in hyperlane: {mailbox, hook}
  isTestnet: boolean
  assets: NetworkAssets
  rpc: [string, ...string[]]
}

interface NetworkAssets {
  [asset: string]: string
}

export interface NetworkConfigs {
  [networkId: string]: NetworkConfig
}
