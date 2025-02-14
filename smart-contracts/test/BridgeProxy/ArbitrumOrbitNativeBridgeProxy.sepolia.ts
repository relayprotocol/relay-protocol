import { ethers, ignition } from 'hardhat'
import { AbiCoder, Interface, type JsonRpcApiProvider } from 'ethers'
import { expect } from 'chai'

import { ArbitrumOrbitNativeBridgeProxy } from '../../typechain-types'
import { networks } from '@relay-protocol/networks'
import { getEvent, getBalance } from '@relay-protocol/helpers'
import { WETH as WETH_ABI } from '@relay-protocol/helpers/abis'
import ArbitrumOrbitNativeBridgeProxyModule from '../../ignition/modules/ArbitrumOrbitNativeBridgeProxyModule'

const ETH_CHAIN_ID = 11155111n
const ARB_CHAIN_ID = 42161n
const {
  bridges: {
    arb: { routerGateway, outbox, arbSys },
  },
  assets: { weth: WETH },
} = networks[ETH_CHAIN_ID.toString()]

// WETH bridge tx on Sepolia
// https://sepolia.arbiscan.io/tx/0x075f42ae6e150209c543959ca8b0f1e3bedcf146c86fb19a073f783b38ed15f3
const recipientAddress = '0x246A13358Fb27523642D86367a51C2aEB137Ac6C'
const amount = 1000n
// construct the actual proof
// NB: we can not test this as constructing the proof
// require calls to the precompiled contracts on Arbitrum
// and this is not supported by hardhat
// (see 'arb/constructProof.ts' in `@relay-protocol/helpers`)
// const {
//   proof,
//   leaf,
//   caller,
//   destination,
//   arbBlockNum,
//   ethBlockNum,
//   timestamp,
//   callvalue,
//   data,
// } = await constructArbProof(
//   originTxHash,
//   ARB_CHAIN_ID,
//   1n,
//   ethers.provider as JsonRpcApiProvider
// )
const returnedProof = {
  proof: [
    '0x661882ba0cccd32245967580aff24faa2166ec4304c21077c030bda28fb72c99',
    '0x35f539cab2df00caa1ef3031caca9bc2cf0db487322c0a41f5a8c98b7a7b4caa',
    '0xcf018f8282f2799e7f4f59cf9a03087f5fd079656103cc3c7530ac570e0d9352',
    '0x979c0bb59eefd27c39ef2c3a9dd038fd2da339854c8eed592d1ee1570c63dc61',
    '0x0963d3d8f0bc5bd382eb96e3860e73a7ba33a60be088d8d485fcdf17d1d01b3b',
    '0xf64e1b3351ca4862e8f8573fa5fb7f95cab41f23441878c947420863925709e0',
    '0x6693dd0b4f1e3b4342fe3b699dddc3d4aa3b83d6328e8d9691f9e4539f9d160e',
    '0x8de0909848f4ec2ec2da37092ae0b7f451d5d05565d74d03333cd725863e325d',
    '0xee371f3a04e073a9dec6b9b78197e4ea7e4357dbba7fed6d2afd722703d5af2a',
    '0x773e09e7cd2b52bac3bebafcd5a34ef9fb35c8874a8fd2d5dc8125be92ab39fb',
    '0xeade8b31de682d8dfa0097f0601667913375b563aae495608c367ed35c5dbe28',
    '0xc3c61c62eb141390607cf998f912d9d04a633ff047eedc1225fb7a23f5630604',
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    '0x965eeffacbb1aae2e91223f35e9f0bd4f702c4aef81e205387df08391df032b9',
    '0xbde930a31a9c54390d252f7a08749cc83fbe5e319aaadd889321e64c837fea95',
    '0x2f86ac8a2a68cf6ce30fcd1cd902e5c7818b7f17133185bb5868dfcf68c64f02',
  ],
  leaf: 59663n,
  caller: '0xCFB1f08A4852699a979909e22c30263ca249556D',
  destination: '0xA8aD8d7e13cbf556eE75CB0324c13535d8100e1E',
  arbBlockNum: 114777495n,
  ethBlockNum: 7490719n,
  timestamp: 1736870198n,
  callvalue: 1000n,
  data: '0x2e567b360000000000000000000000007b79995e5f793a07bc00c21412e50ecae098e7f9000000000000000000000000f98d7ada874d53a75bbdfb05d2a96c1525d426a7000000000000000000000000246a13358fb27523642d86367a51c2aeb137ac6c00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000',
}

// encode args to pass to pool
const args = [
  returnedProof.proof,
  returnedProof.leaf, // position/index
  returnedProof.caller, //l2 sender
  returnedProof.destination, // to
  returnedProof.arbBlockNum, //l2block
  returnedProof.ethBlockNum, // l1block
  returnedProof.timestamp, //l2 ts
  returnedProof.callvalue, // value
  returnedProof.data,
]

// send claim to the pool
const abiCoder = new AbiCoder()
const bridgeParams = abiCoder.encode(
  [
    'bytes32[]',
    'uint256',
    'address',
    'address',
    'uint256',
    'uint256',
    'uint256',
    'uint256',
    'bytes',
  ],
  args
)

describe('ArbitrumOrbitNativeBridgeProxy', function () {
  let bridge: ArbitrumOrbitNativeBridgeProxy

  before(async () => {
    // deploy using ignition
    const parameters = {
      ArbitrumOrbitNativeBridgeProxy: {
        routerGateway,
        outbox,
      },
    }

    ;({ bridge } = await ignition.deploy(ArbitrumOrbitNativeBridgeProxyModule, {
      parameters,
    }))
  })

  it('constructor values are correct', async () => {
    expect(await bridge.ROUTER()).to.be.equal(routerGateway)
    expect(await bridge.ARB_SYS()).to.be.equal(arbSys)
  })

  describe('claim using BridgeProxy directly', () => {
    it.skip('works using native', async () => {
      // https://arbiscan.io/tx/0x650570bd55b1bf54cd64d8882b4cc8b58f06c475ec17fdba93f2fbfa23fca340
      // const originTxHash =
      //   '0x650570bd55b1bf54cd64d8882b4cc8b58f06c475ec17fdba93f2fbfa23fca340'
    })

    it('works with ERC20 (WETH)', async () => {
      const balanceBefore = await getBalance(
        recipientAddress,
        WETH!,
        ethers.provider
      )
      const tx = await bridge.claim(ethers.ZeroAddress, bridgeParams)
      const balanceAfter = await getBalance(
        recipientAddress,
        WETH!,
        ethers.provider
      )

      const receipt = await tx.wait()

      // weth transfer happened
      const { event: wethTransferEvent } = await getEvent(
        receipt!,
        'Transfer',
        new Interface(WETH_ABI)
      )
      expect(wethTransferEvent.args.dst).to.equals(recipientAddress)
      expect(wethTransferEvent.args.wad).to.equals(amount.toString())

      // outbox recorded
      const { event: outboxEvent } = await getEvent(
        receipt!,
        'OutBoxTransactionExecuted'
      )
      expect(outboxEvent.args.to).to.equals(returnedProof.destination)
      expect(outboxEvent.args.l2Sender).to.equals(returnedProof.caller)
      expect(balanceAfter).to.equals(balanceBefore + amount)
    })
  })
})
