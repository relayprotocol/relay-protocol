import fs from 'fs'

const addresses: { [string]: any } = {}

const basePath = __dirname + '/../../ignition/deployments/'
export const getAddressForFile = (file: string) => {
  const deployments = JSON.parse(fs.readFileSync(basePath + file, 'utf-8'))
  return Object.values(deployments)[0]
}

export const getAddresses = () => {
  fs.readdirSync(basePath).forEach((file) => {
    let match
    if ((match = file.match(/BridgeProxy-(?<bridge>.*)-(?<chainId>.*)/))) {
      addresses[match.groups!.chainId] ||= {}
      addresses[match.groups!.chainId].BridgeProxy ||= {}
      const address = getAddressForFile(file + '/deployed_addresses.json')
      if (address) {
        addresses[match.groups!.chainId].BridgeProxy[match.groups!.bridge] =
          address
      }
    } else if ((match = file.match(/RelayBridgeFactory-(?<chainId>.*)/))) {
      addresses[match.groups!.chainId] ||= {}
      const address = getAddressForFile(file + '/deployed_addresses.json')
      if (address) {
        addresses[match.groups!.chainId].RelayBridgeFactory = address
      }
    } else if ((match = file.match(/RelayPoolFactory-(?<chainId>.*)/))) {
      addresses[match.groups!.chainId] ||= {}
      const address = getAddressForFile(file + '/deployed_addresses.json')
      if (address) {
        addresses[match.groups!.chainId].RelayPoolFactory = address
      }
    }
  })
  return addresses
}
