import assert from 'assert'

export const reverts = async (call: Promise<T>, msg?: string) => {
  let hasReverted = false
  try {
    await call
  } catch (error) {
    hasReverted = true
    const actualError = error.message.replace(
      /Returned error: VM Exception while processing transaction: (revert )?/,
      ''
    )
    if (msg) {
      assert(
        actualError.includes(msg),
        `Wrong Error received: ${error.message}`
      )
    }
  }
  if (!hasReverted) {
    assert.fail('Expected an exception but none was received')
  }
}
