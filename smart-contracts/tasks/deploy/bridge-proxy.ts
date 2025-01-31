import { task } from 'hardhat/config'
import { networks } from '@relay-protocol/networks'
import { type BaseContract } from 'ethers'
import { AutoComplete } from 'enquirer'

import CCTPBridgeProxyModule from '../../ignition/modules/CCTPBridgeProxyModule'
import OPStackNativeBridgeProxyModule from '../../ignition/modules/OPStackNativeBridgeProxyModule'
import ArbitrumOrbitNativeBridgeProxyModule from '../../ignition/modules/ArbitrumOrbitNativeBridgeProxyModule'

task('deploy:bridge-proxy', 'Deploy a bridge proxy')
  .addOptionalParam('type', 'the type of bridge to deploy')
  .setAction(async ({ type }, { ethers, ignition, run }) => {
    const { chainId } = await ethers.provider.getNetwork()

    const { bridges } = networks[chainId.toString()]

    if (!type) {
      type = await new AutoComplete({
        name: 'type',
        message: 'Please choose a proxy type?',
        choices: Object.keys(bridges),
      }).run()
    }

    // get args value
    const { name } = networks[chainId.toString()]
    console.log(`deploying ${type} proxy bridge on ${name} (${chainId})...`)

    let proxyBridgeAddress

    // deploy bridge proxy
    let proxyBridge: BaseContract
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
      const deploymentId = `BridgeProxy-cctp-${chainId.toString()}`
      // deploy CCTP bridge
      ;({ bridge: proxyBridge } = await ignition.deploy(CCTPBridgeProxyModule, {
        parameters,
        deploymentId,
      }))
      proxyBridgeAddress = await proxyBridge.getAddress()

      // verify!
      await run('verify:verify', {
        address: proxyBridgeAddress,
        constructorArguments: [messenger, transmitter, USDC],
      })
      console.log(`CCTP bridge deployed at: ${proxyBridgeAddress}`)
    } else if (type === 'op') {
      const portalProxy = bridges.op!.portalProxy! || ethers.ZeroAddress // Only used on the L1 deployments (to claim the assets)
      const parameters = {
        OPStackNativeBridgeProxy: {
          portalProxy,
        },
      }
      const deploymentId = `BridgeProxy-op-${chainId.toString()}`
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
      await run('verify:verify', {
        address: proxyBridgeAddress,
        constructorArguments: [portalProxy],
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
      const deploymentId = `BridgeProxy-arb-${chainId.toString()}`
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
      await run('verify:verify', {
        address: proxyBridgeAddress,
        constructorArguments: [routerGateway, outbox],
      })
      console.log(`ArbOrbit bridge deployed at: ${proxyBridgeAddress}`)
    }

    return proxyBridgeAddress
  })
