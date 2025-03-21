import addresses from './addresses.json'
import { Addresses } from '../bin/generateAddressFile'

export const getAddresses = (): Addresses => {
  return addresses as Addresses
}
