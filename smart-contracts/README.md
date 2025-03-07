# payday-pools

## Contracts used for Relay Vaults & Bridges:

### RelayPool

- RelayPool let Liquidity Providers (LP) deposit and withdraw a specific asset and receive yield for their deposit. The RelayPool contracts do _not_ hold the liquidity themselves and just "forward" the funds to a "base yield" contract (Aave, Morpho... etc). They also implement a `handle` function and a `claim` function which are respectively used to "loan" funds to another user who has initiated a "fast" withdrawal from an L2 contract, as well as claim the funds once they have effectively crossed the bridge.
- RelayPool aimed at being deployed on L1 (ethereum mainnet) for a specific asset (wrapped ETH, or other ERC20s) and can handle funds coming from multiple sources, as long as it is the same asset. Each origin has its own `BridgeProxy` contract that implements the specific claim for a given L2/Bridge.
- The `handle` function is called by Hyperlane to indicate that a user has initiated an L2->L1 withdrawal and that the user can receive funds (minus fees), since the RelayPool has insurance that the funds will eventually be transfered.
- RelayPools are deployed thru a `RelayPoolFactory` for convenience. When a pool uses wrapped ETH, we offer a `RelayPoolNativeGateway` which lets users deposit ETH directly without the need to wrap.
- RelayPools have a curator which is an address that can perform configuration changes (adding new origins, updating the bridge fee, or even chamging the "base yield" contract). It is possible for an attacker to steal funds from LP, which is why it is critical that this address points to a timelock contract (LPs could withdraw their funds before a malicious transaction is submitted). This timelock should itself receive its operations from a multi-sig, or even a governor contract that uses the RelayVault shares to let LP collectively govern the pool if needed.

### RelayBridge

RelayBridge contracts let solvers (or other users) initiate a withdrwal from an L2 to the L1. They are asset-specific. They also call a L2/Bridge specific `BridgeProxy` in order to initiate the withdrwal. When called, the issue both an Hyperlane message and a bridge withdrwal.

### ProxyBridge contracts

The actual bridging logic is abstracted away and implemented in various ProxyBridge contracts for the OPStack, Arbitrum Orbit and others. It is in theory possible to create these bridges for any bridge (native or not).

## Deploy contracts

For all deployments you need a private key:

```
# export your private key to the shell
export DEPLOYER_PRIVATE_KEY=...
```

The deployment tasks do include contract verifications.

### Deploy the factories

The factories are not strictly necessary for the protocol to operate but they provide convenience to identify deployed contracts. These addresses are added to the `../backend` application.
You should not have to deploy factories.

When deploying to a network, make sure you first add the network details in the package `../packages/network` and run `yarn build`.

```
# Bridge factory (deployed on L2)
yarn run hardhat deploy:bridge-factory --network op-sepolia

# Pool factory (deployed on L1)
yarn run hardhat deploy:pool-factory --network sepolia
```

```
yarn run hardhat ignition verify <name of deployment from ignition/deployments/>
```

### Deploy protocol contracts

#### Deploy the pool on the L1

We start by deploying the pool without any origin configured.

```
# Deploy a relay pool on the L1 (the cli will prompt for parameters and may deploy a base yield pool):
yarn hardhat deploy:pool --network sepolia
⚠️ Using account from DEPLOYER_PRIVATE_KEY environment variable.
deploying on Ethereum Sepolia (11155111)...
✔ Please choose the asset for your relay bridge (make sure it is supported by the proxy bridge you selected): · weth
✔ Please choose a yield pool: · dummy
Dummy yield pool deployed at 0xC08DCC23F847C566104964d11Be638FE34C78E8e
Verifying...
The contract 0xC08DCC23F847C566104964d11Be638FE34C78E8e has already been verified on the block explorer. If you're trying to verify a partially verified contract, please use the --force flag.
https://sepolia.etherscan.io/address/0xC08DCC23F847C566104964d11Be638FE34C78E8e#code

The contract 0xC08DCC23F847C566104964d11Be638FE34C78E8e has already been verified on Sourcify.
https://repo.sourcify.dev/contracts/full_match/11155111/0xC08DCC23F847C566104964d11Be638FE34C78E8e/

✔ Please enter a pool name: · Wrapped Ether Relay Pool
✔ Please enter a pool symbol: · WETH-REL
relayPool deployed to: 0x794dE8b61567D0dE557CE60f1968f6C9E188e97E
The contract 0x794dE8b61567D0dE557CE60f1968f6C9E188e97E has already been verified on the block explorer. If you're trying to verify a partially verified contract, please use the --force flag.
https://sepolia.etherscan.io/address/0x794dE8b61567D0dE557CE60f1968f6C9E188e97E#code

Successfully verified contract RelayPool on Sourcify.
https://repo.sourcify.dev/contracts/full_match/11155111/0x794dE8b61567D0dE557CE60f1968f6C9E188e97E/

```

#### Adding origins

Now that the pool has been deployed on the L1, we need to add origins to it.
First, we need to deploy the L2 Bridge contract on the L2.

```
# Deploy a bridge proxy on an L1

yarn hardhat deploy:bridge-proxy --network sepolia
```

## Use with ZkSync

```
yarn hardhat compile --network zksync
```
