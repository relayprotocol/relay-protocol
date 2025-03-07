import { task } from 'hardhat/config'
import { networks } from '@relay-protocol/networks'
import { type BaseContract } from 'ethers'
import { AutoComplete, Select } from 'enquirer'

import CCTPBridgeProxyModule from '../../ignition/modules/CCTPBridgeProxyModule'
import OPStackNativeBridgeProxyModule from '../../ignition/modules/OPStackNativeBridgeProxyModule'
import ArbitrumOrbitNativeBridgeProxyModule from '../../ignition/modules/ArbitrumOrbitNativeBridgeProxyModule'
import { deployContract } from '../../lib/zksync'
import ZkSyncBridgeProxyModule from '../../ignition/modules/ZkSyncBridgeProxyModule'
import { L2NetworkConfig } from '@relay-protocol/types'
import { GET_ALL_POOLS, RelayVaultService } from '@relay-protocol/client'
import { getAddresses } from '@relay-protocol/addresses'

// We must deployed on the L1 first!
// So we need to

task('deploy:bridge-proxy', 'Deploy a bridge proxy')
  .addOptionalParam('type', 'the type of bridge to deploy')
  .addOptionalParam(
    'poolAddress',
    'the relay pool address where the funds are eventually sent'
  )
  .setAction(async ({ type, poolAddress }, hre) => {
    const { ethers, ignition } = hre
    const { chainId } = await ethers.provider.getNetwork()
    const networkConfig = networks[chainId.toString()]
    const { bridges, isZKsync } = networkConfig

    let { l1ChainId } = networkConfig as L2NetworkConfig
    let l1BridgeProxy

    const vaultService = new RelayVaultService(
      'https://relay-protocol-production.up.railway.app/' // TODO: add to config?
    )

    if (!poolAddress) {
      const { relayPools } = await vaultService.query(GET_ALL_POOLS)
      if (relayPools.items.length === 0) {
        throw new Error('No pools found!')
      }
      const poolName = await new Select({
        message:
          'Which pool do you want this bridge proxy to send its funds to?',
        choices: relayPools.items.map((pool) => pool.name),
      }).run()
      const pool = relayPools.items.find((pool) => pool.name === poolName)
      poolAddress = pool.contractAddress
    }

    // Let's get the pools on l1ChainId so we can get relayPool
    // Also, we must deploy the l1 proxyBridge first...
    const types = ['cctp', 'op', 'arb', 'zksync']
    if (!type) {
      type = await new AutoComplete({
        name: 'type',
        message: 'Please choose a proxy type?',
        choices: types,
      }).run()
    }

    if (!l1ChainId) {
      // We are deploying the BridgeProxy on an L1 chain on the L1
      l1ChainId = chainId
      l1BridgeProxy = ethers.ZeroAddress // The l1BridgeProxy is the one to be deployed!
    } else {
      const l1DeployedAddresses = getAddresses()[l1ChainId]
      if (!l1DeployedAddresses.BridgeProxy[type]) {
        throw new Error(
          `There is no ${type} bridge proxy deployed on L1! Please deploy it first! Don't forget to run yarn run generate in packages/addresses`
        )
      }
      // We are deploying the BridgeProxy on an L2 chain
      l1BridgeProxy = l1DeployedAddresses.BridgeProxy[type]
    }

    // get args value
    const { name } = networks[chainId.toString()]
    console.log(`deploying ${type} proxy bridge on ${name} (${chainId})...`)

    let proxyBridgeAddress

    // deploy bridge proxy
    let proxyBridge: BaseContract

    const deploymentId = `BridgeProxy-${type}-${chainId.toString()}`
    if (type === 'cctp') {
      const {
        bridges: {
          cctp: { messenger, transmitter },
        },
        assets: { usdc: USDC },
      } = networks[chainId.toString()]
      const parameters = {
        CCTPBridgeProxy: {
          messenger,
          transmitter,
          usdc: USDC,
        },
      }
      // deploy CCTP bridge
      ;({ bridge: proxyBridge } = await ignition.deploy(CCTPBridgeProxyModule, {
        parameters,
        deploymentId,
      }))
      proxyBridgeAddress = await proxyBridge.getAddress()

      // verify!
      await run('deploy:verify', {
        address: proxyBridgeAddress,
        constructorArguments: [messenger, transmitter, USDC],
      })
      console.log(`CCTP bridge deployed at: ${proxyBridgeAddress}`)
    } else if (type === 'op') {
      const portalProxy = bridges.op!.portalProxy! || ethers.ZeroAddress // Only used on the L1 deployments (to claim the assets)
      const parameters = {
        OPStackNativeBridgeProxy: {
          portalProxy,
          relayPoolChainId: l1ChainId,
          relayPool: poolAddress,
          l1BridgeProxy,
        },
      }
      // deploy OP bridge
      ;({ bridge: proxyBridge } = await ignition.deploy(
        OPStackNativeBridgeProxyModule,
        {
          parameters,
          deploymentId,
        }
      ))
      proxyBridgeAddress = await proxyBridge.getAddress()

      // verify!
      await run('deploy:verify', {
        address: proxyBridgeAddress,
        constructorArguments: [
          portalProxy,
          l1ChainId,
          poolAddress,
          l1BridgeProxy,
        ],
      })
      console.log(`OPStack bridge deployed at: ${proxyBridgeAddress}`)
    } else if (type === 'arb') {
      const routerGateway = bridges.arb!.routerGateway
      const outbox = bridges.arb!.outbox || ethers.ZeroAddress // Only used on the L1 deployments (to claim the assets)

      const parameters = {
        ArbitrumOrbitNativeBridgeProxy: {
          routerGateway,
          outbox,
        },
      }
      // deploy ARB bridge
      ;({ bridge: proxyBridge } = await ignition.deploy(
        ArbitrumOrbitNativeBridgeProxyModule,
        {
          parameters,
          deploymentId,
        }
      ))
      proxyBridgeAddress = await proxyBridge.getAddress()

      // verify!
      await run('deploy:verify', {
        address: proxyBridgeAddress,
        constructorArguments: [routerGateway, outbox],
      })
      console.log(`ArbOrbit bridge deployed at: ${proxyBridgeAddress}`)
    } else if (type === 'zksync') {
      let zkSyncBridgeAddress: string
      const l2SharedDefaultBridge = bridges.zksync!.l2SharedDefaultBridge!
      const l1SharedDefaultBridge = bridges.zksync!.l1SharedDefaultBridge!
      if (isZKsync) {
        // deploy using `deployContract` helper (for zksync L2s)
        const deployArgs = [l2SharedDefaultBridge, l1SharedDefaultBridge]

        ;({ address: zkSyncBridgeAddress } = await deployContract(
          hre,
          'ZkSyncBridgeProxy',
          deployArgs as any
        ))
      } else {
        // used ignition to deploy bridge on L1
        const parameters = {
          ZkSyncBridgeProxy: {
            l2SharedDefaultBridge,
            l1SharedDefaultBridge,
          },
        }
        ;({ bridge: proxyBridge } = await ignition.deploy(
          ZkSyncBridgeProxyModule,
          {
            parameters,
            deploymentId,
          }
        ))
        proxyBridgeAddress = await proxyBridge.getAddress()
        console.log(
          `Zksync BridgeProxy contract deployed at ${proxyBridgeAddress}`
        )
        await run('deploy:verify', {
          address: proxyBridgeAddress,
          constructorArguments: [routerGateway, outbox],
        })
      }
    }

    return proxyBridgeAddress
  })
