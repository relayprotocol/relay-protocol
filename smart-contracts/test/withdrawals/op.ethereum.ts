import { ethers } from 'hardhat'
import { networks } from '@relay-protocol/networks'
import { time } from '@nomicfoundation/hardhat-network-helpers'
import {
  buildFinalizeOpWithdrawal,
  buildLegacyOpProveWithdrawal,
} from '@relay-protocol/helpers'
import { expect } from 'chai'
import * as ABIs from '@relay-protocol/helpers/abis'
import { IOptimismPortal } from '../../typechain-types'

const {
  bridges: { op },
  assets: { weth },
} = networks[1]

describe('op withdrawal helper', function () {
  let portalProxy: IOptimismPortal
  before(async () => {
    portalProxy = await ethers.getContractAt('IOptimismPortal', op.portalProxy)
  })

  it('should work for the base sequence using ETH', async () => {
    // https://optimistic.etherscan.io/tx/0x8a8ed32ec52267ba5c5656dc68f459a8be3cdd23d8a1128ed321a2c6df2e8ee3
    const submitter = '0xF5C28ce24Acf47849988f147d5C75787c0103534'
    const withdrawalHash =
      '0x8a8ed32ec52267ba5c5656dc68f459a8be3cdd23d8a1128ed321a2c6df2e8ee3'
    await time.increaseTo(new Date('2025-07-01').getTime() / 1000)

    const finalizeParams = await buildFinalizeOpWithdrawal(10, withdrawalHash)

    // Call portal to withdraw
    const tx = await portalProxy.finalizeWithdrawalTransactionExternalProof(
      finalizeParams,
      submitter
    )

    const receipt = await tx.wait()

    expect(receipt.logs.length).to.equal(4)
    receipt.logs.forEach((log: Log) => {
      expect(log.address).to.be.oneOf([
        '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1', // L1StandardBridgeProxy
        '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1', // L1CrossDomainMessengerProxy
        op.portalProxy, // OptimismPortalProxy
        weth,
      ])
      if (log.address === '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1') {
        const iface = new ethers.Interface(ABIs.L1StandardBridge)
        const event = iface.parseLog(log)
        expect(event.name).to.be.oneOf([
          'ETHBridgeFinalized',
          'ETHWithdrawalFinalized',
        ])
        expect(event.args.from).to.equal(
          '0xF5C28ce24Acf47849988f147d5C75787c0103534'
        )
        expect(event.args.to).to.equal(
          '0xF5C28ce24Acf47849988f147d5C75787c0103534'
        )
        expect(event.args.amount).to.equal(1000000000000000n)
        expect(event.args.extraData).to.equal('0x7375706572627269646765')
      } else if (log.address === '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1') {
        const iface = new ethers.Interface(ABIs.L2CrossDomainMessenger)
        const event = iface.parseLog(log)
        expect(event.name).to.equal('RelayedMessage')
        expect(event.args.msgHash).to.equal(
          '0x9e16c5899d5e4e83897fa35082e0a65ef4b7853bdc573f9a8a3ed645ce4bb473'
        )
      } else if (log.address === op.portalProxy) {
        const iface = new ethers.Interface(ABIs.Portal2)
        const event = iface.parseLog(log)
        expect(event.name).to.equal('WithdrawalFinalized')
        expect(event.args.withdrawalHash).to.equal(
          '0x332288a193bbd08ed40a2dadc309e7588d94a9d6ab28c9dc17655eef64e38e34'
        )
        expect(event.args.success).to.equal(true)
      } else if (log.address === weth) {
        const iface = new ethers.Interface(ABIs.WETH)
        const event = iface.parseLog(log)
        expect(event.name).to.equal('Deposit')
        expect(event.args.dst).to.equal(bridgeAddress)
        // In the tx `0x8a8ed32ec52267ba5c5656dc68f459a8be3cdd23d8a1128ed321a2c6df2e8ee3` the
        // recipient is _not_ the bridge... so we can't test that funds are properly sent to it.
        expect(event.args.wad).to.equal(0)
      }
    })
  })

  it.skip('should work for the base sequence using an ERC20', async () => {
    // https://optimistic.etherscan.io/tx/0xe21e6a9d6c214c50d1fa864d21a9db35c9f05b14d683d773146fc8ec42f256c1
    const withdrawalHash =
      '0xe21e6a9d6c214c50d1fa864d21a9db35c9f05b14d683d773146fc8ec42f256c1'

    // Get the withdrawal data
    const proof = await buildOpProveWithdrawal(10, withdrawalHash, 1)
    const withdrawal = await buildFinalizeOpWithdrawal(10, withdrawalHash)

    // Prove the withdrawal
    const tx1 = await portal.proveWithdrawalTransaction(
      proof.outputRootProof,
      proof.withdrawalProof,
      withdrawal
    )
    await tx1.wait()

    // Finalize the withdrawal
    const tx2 = await portal
      .connect(user)
      .finalizeWithdrawalTransaction(withdrawal)
    const receipt = await tx2.wait()

    // Verify the events
    receipt.logs.forEach((log: Log) => {
      expect(log.address).to.be.oneOf([
        '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1', // L1StandardBridgeProxy
        '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1', // L1CrossDomainMessengerProxy
        op.portalProxy, // OptimismPortalProxy
      ])
      if (log.address === '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1') {
        const iface = new ethers.Interface(ABIs.L1StandardBridge)
        const event = iface.parseLog(log)
        expect(event.name).to.equal('ERC20BridgeFinalized')
        expect(event.args.localToken).to.equal(
          '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'
        )
        expect(event.args.remoteToken).to.equal(
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        )
        expect(event.args.from).to.equal(
          '0xF5C28ce24Acf47849988f147d5C75787c0103534'
        )
        expect(event.args.to).to.equal(
          '0xF5C28ce24Acf47849988f147d5C75787c0103534'
        )
        expect(event.args.amount).to.equal(1000000000000000n)
        expect(event.args.extraData).to.equal('0x7375706572627269646765')
      } else if (log.address === '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1') {
        const iface = new ethers.Interface(ABIs.L2CrossDomainMessenger)
        const event = iface.parseLog(log)
        expect(event.name).to.equal('RelayedMessage')
        expect(event.args.msgHash).to.equal(
          '0x9e16c5899d5e4e83897fa35082e0a65ef4b7853bdc573f9a8a3ed645ce4bb473'
        )
      } else if (log.address === op.portalProxy) {
        const iface = new ethers.Interface(ABIs.Portal2)
        const event = iface.parseLog(log)
        expect(event.name).to.equal('WithdrawalFinalized')
        expect(event.args.withdrawalHash).to.equal(
          '0x332288a193bbd08ed40a2dadc309e7588d94a9d6ab28c9dc17655eef64e38e34'
        )
        expect(event.args.success).to.equal(true)
      }
    })
  })
})

describe('op legacy withdrawal helper', function () {
  let portalProxy: IOptimismPortal
  before(async () => {
    portalProxy = await ethers.getContractAt('IOptimismPortal', op.portalProxy)
  })

  it.only('should work for the base sequence using ETH', async () => {
    // https://blockscout.lisk.com/tx/0x3fbf60e896274ee50b7158f5b5aa5c5e797a63be30be7cebe27c49ffc585b209
    const submitter = '0x1D682340264cF209257f24C3EDcb2a9fc0592535'
    const withdrawalHash =
      '0x3fbf60e896274ee50b7158f5b5aa5c5e797a63be30be7cebe27c49ffc585b209'
    await time.increaseTo(new Date('2025-07-01').getTime() / 1000)

    const finalizeParams = await buildLegacyOpProveWithdrawal(
      1135,
      withdrawalHash,
      1
    )
    console.log(finalizeParams)

    // Call portal to withdraw
    // const tx = await portalProxy.finalizeWithdrawalTransactionExternalProof(
    //   finalizeParams,
    //   submitter
    // )

    // const receipt = await tx.wait()

    // expect(receipt.logs.length).to.equal(4)
    // receipt.logs.forEach((log: Log) => {
    //   expect(log.address).to.be.oneOf([
    //     '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1', // L1StandardBridgeProxy
    //     '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1', // L1CrossDomainMessengerProxy
    //     op.portalProxy, // OptimismPortalProxy
    //     weth,
    //   ])
    //   if (log.address === '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1') {
    //     const iface = new ethers.Interface(ABIs.L1StandardBridge)
    //     const event = iface.parseLog(log)
    //     expect(event.name).to.be.oneOf([
    //       'ETHBridgeFinalized',
    //       'ETHWithdrawalFinalized',
    //     ])
    //     expect(event.args.from).to.equal(
    //       '0xF5C28ce24Acf47849988f147d5C75787c0103534'
    //     )
    //     expect(event.args.to).to.equal(
    //       '0xF5C28ce24Acf47849988f147d5C75787c0103534'
    //     )
    //     expect(event.args.amount).to.equal(1000000000000000n)
    //     expect(event.args.extraData).to.equal('0x7375706572627269646765')
    //   } else if (log.address === '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1') {
    //     const iface = new ethers.Interface(ABIs.L2CrossDomainMessenger)
    //     const event = iface.parseLog(log)
    //     expect(event.name).to.equal('RelayedMessage')
    //     expect(event.args.msgHash).to.equal(
    //       '0x9e16c5899d5e4e83897fa35082e0a65ef4b7853bdc573f9a8a3ed645ce4bb473'
    //     )
    //   } else if (log.address === op.portalProxy) {
    //     const iface = new ethers.Interface(ABIs.Portal2)
    //     const event = iface.parseLog(log)
    //     expect(event.name).to.equal('WithdrawalFinalized')
    //     expect(event.args.withdrawalHash).to.equal(
    //       '0x332288a193bbd08ed40a2dadc309e7588d94a9d6ab28c9dc17655eef64e38e34'
    //     )
    //     expect(event.args.success).to.equal(true)
    //   } else if (log.address === weth) {
    //     const iface = new ethers.Interface(ABIs.WETH)
    //     const event = iface.parseLog(log)
    //     expect(event.name).to.equal('Deposit')
    //     expect(event.args.dst).to.equal(bridgeAddress)
    //     // In the tx `0x8a8ed32ec52267ba5c5656dc68f459a8be3cdd23d8a1128ed321a2c6df2e8ee3` the
    //     // recipient is _not_ the bridge... so we can't test that funds are properly sent to it.
    //     expect(event.args.wad).to.equal(0)
    //   }
    // })
  })
})
