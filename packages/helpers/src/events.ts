import { ethers } from 'ethers-v6'
import type {
  TransactionReceipt,
  Log,
  Interface,
  EventLog,
  LogDescription,
} from 'ethers-v6'
import * as abis from './abis'

export const decodeLogs = (
  logs: readonly (EventLog | Log)[],
  iface?: Interface
) => {
  const allAbis = Object.keys(abis)
    .map((k) => abis[k as keyof typeof abis])
    .flat()
    .filter(({ type }) => type === 'event')
  // .reduce((prev, curr) => [...prev, ...curr], [])

  if (!iface) {
    iface = new ethers.Interface(allAbis)
  }

  const decoded = logs.map((log) => {
    const parsed = iface.parseLog(log)
    return parsed ? parsed : log
  })
  return decoded
}

export const getEvent = async (
  receipt: TransactionReceipt,
  eventName: string,
  interfaceOrAddress?: Interface | string,
  iface?: Interface
) => {
  const events = await getEvents(receipt, eventName, interfaceOrAddress, iface)
  const event = (events.events || [])[0] as LogDescription
  const { args } = event || {}
  return { args, event, ...events }
}

export const getEvents = async (
  receipt: TransactionReceipt,
  eventName: string,
  interfaceOrAddress?: Interface | string,
  iface?: Interface
) => {
  const { hash, blockNumber } = receipt
  const logs =
    typeof interfaceOrAddress === 'string'
      ? receipt.logs.filter(({ address }) => address === interfaceOrAddress)
      : receipt.logs

  if (interfaceOrAddress && typeof interfaceOrAddress !== 'string' && !iface) {
    iface = interfaceOrAddress
  }
  const events = decodeLogs(logs, iface).filter(
    (log) => (log as LogDescription)?.name === eventName
  )
  return { blockNumber, events, hash }
}
