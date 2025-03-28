import { type Contract } from 'ethers-v6'

export async function checkAllowance(
  asset: Contract,
  dest: string,
  amount: bigint,
  userAddress: string
) {
  const allowance = await asset.allowance(userAddress, dest)
  if (allowance < amount) {
    console.log(
      `Insufficient allowance (actual: ${allowance}, expected: ${amount})`
    )
    console.log(`Approving pool spending for ${amount}...`)
    // TODO: get signer
    await asset.approve(dest, amount)
  } else {
    console.log(`Allowance ok (actual: ${allowance}, expected: ${amount})`)
  }
}
