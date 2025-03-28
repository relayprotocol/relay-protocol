export const buildLegacyOpProveWithdrawal = async (
  chainId: number,
  transactionHash: string,
  l1ChainId: number
) => {
  console.log({
    chainId,
    l1ChainId,
    transactionHash,
  })
}

const main = async () => {
  await buildLegacyOpProveWithdrawal(
    1135,
    '0x3fbf60e896274ee50b7158f5b5aa5c5e797a63be30be7cebe27c49ffc585b209',
    1
  )
}

// execute as standalone
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
