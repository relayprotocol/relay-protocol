import fs from 'fs-extra'
import path from 'path'

export interface Addresses {
  [chainId: number]: {
    RelayBridgeFactory?: `0x${string}`
    RelayPoolFactory?: `0x${string}`
    RelayPoolNativeGateway?: `0x${string}`
  }
}

const addresses: Addresses = {}

const basePath = __dirname + '/../../../smart-contracts/ignition/deployments/'
export const getAddressForFile = (
  file: string,
  contractName: string
): `0x${string}` => {
  const deployments = JSON.parse(fs.readFileSync(basePath + file, 'utf-8'))
  return deployments[contractName] as `0x${string}`
}

export const getAddresses = () => {
  fs.readdirSync(basePath).forEach((file) => {
    let match
    if ((match = file.match(/RelayBridgeFactory-(?<chainId>.*)/))) {
      addresses[Number(match.groups!.chainId)] ||= {}
      const address = getAddressForFile(
        file + '/deployed_addresses.json',
        'RelayBridgeFactory#RelayBridgeFactory'
      )
      if (address) {
        addresses[Number(match.groups!.chainId)].RelayBridgeFactory = address
      }
    } else if ((match = file.match(/RelayPoolFactory-(?<chainId>.*)/))) {
      addresses[Number(match.groups!.chainId)] ||= {}
      const address = getAddressForFile(
        file + '/deployed_addresses.json',
        'RelayPoolFactory#RelayPoolFactory'
      )
      if (address) {
        addresses[Number(match.groups!.chainId)].RelayPoolFactory = address
      }
    } else if ((match = file.match(/RelayPoolNativeGateway-(?<chainId>.*)/))) {
      addresses[Number(match.groups!.chainId)] ||= {}
      const address = getAddressForFile(
        file + '/deployed_addresses.json',
        'RelayPoolNativeGateway#RelayPoolNativeGateway'
      )
      if (address) {
        addresses[Number(match.groups!.chainId)].RelayPoolNativeGateway =
          address
      }
    }
  })
  return addresses
}

const generateAddressFile = async () => {
  const addresses = getAddresses()
  const abiFileName = path.resolve('src', 'addresses.json')
  await fs.outputJSON(abiFileName, addresses, { spaces: 2 })
}

generateAddressFile()
