# @relay-protocol/arb-claimer

A package for constructing Arbitrum L2 to L1 message proofs.

## Installation

```bash
npm install @relay-protocol/arb-claimer
```

## Usage

```typescript
import { constructArbProof } from '@relay-protocol/arb-claimer'

// Construct a proof for an L2 transaction
const proof = await constructArbProof(
  '0x...', // L2 transaction hash
  '421614', // L2 chain ID (Arbitrum Sepolia)
  11155111 // L1 chain ID (Sepolia)
)

// The proof can then be used to claim the message on L1
```

## API

### `constructArbProof`

Constructs a proof for an Arbitrum L2 to L1 message.

```typescript
async function constructArbProof(
  l2TransactionHash: string,
  l2ChainId: bigint | string,
  l1ChainId?: bigint, // defaults to Sepolia (11155111)
  l1Provider?: JsonRpcProvider
): Promise<{
  arbBlockNum: bigint
  caller: string
  callvalue: bigint
  data: string
  destination: string
  ethBlockNum: bigint
  leaf: bigint
  proof: string[]
  timestamp: bigint
}>
```

## License

MIT
