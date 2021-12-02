import { ethers } from 'ethers';
import { config } from 'dotenv';
import { formatEther } from '@ethersproject/units';

config();

const FREEROSSDAO_SAFE_ADDRESS = '0xc102d2544a7029f7BA04BeB133dEADaA57fDF6b4';
const BLOCKS_PER_CHUNK = 50;

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_ENDPOINT as string);
const safe = new ethers.Contract(
  FREEROSSDAO_SAFE_ADDRESS,
  [`event SafeReceived(address indexed sender, uint256 value)`],
  provider,
);

async function main() {
  const [, , _fromBlock, _toBlock] = process.argv;
  const fromBlock = parseInt(_fromBlock);
  const toBlock = _toBlock
    ? parseInt(_toBlock)
    : await provider.getBlockNumber().then((num) => num.toString());

  console.log(`Snapshotting from ${fromBlock} to ${toBlock}`);
  const filter = safe.filters.SafeReceived();

  const handleContribution = (sender: string, value: ethers.BigNumber) => {
    console.log(`${sender} sent ${formatEther(value)} ETH`);
  };

  for (let i = fromBlock; i <= toBlock; i = i + BLOCKS_PER_CHUNK) {
    const fromChunkNumber = i;
    const toChunkNumber = i + BLOCKS_PER_CHUNK - 1;

    console.log(`checking in ${fromChunkNumber} => ${toChunkNumber}...`);

    const events = await safe.queryFilter(filter, fromChunkNumber, toChunkNumber);
    events.filter(Boolean).forEach((event: ethers.Event) => {
      if (!event.args?.sender || !event.args?.value) {
        console.log(`Invalid event??`, event);
        return;
      }

      handleContribution(event.args.sender as string, event.args.value as ethers.BigNumber);
    });
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
