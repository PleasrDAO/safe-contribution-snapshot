import { ethers } from 'ethers';
import { config } from 'dotenv';
import { formatEther } from '@ethersproject/units';

import {
  CEX_OVERRIDES,
  EXCLUDE_TRANSACTIONS,
  KNOWN_MISSING_TRANSACTIONS,
} from './lib/transactions';
import { AUCTION_ENDED_IN_BLOCK, FREEROSSDAO_SAFE_ADDRESS, BLOCKS_PER_CHUNK } from './lib/const';
import { readFromSnapshot, writeToSnapshot, getNextBlock, setNextBlock } from './lib/io';

config();

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_ENDPOINT as string);
const safe = new ethers.Contract(
  FREEROSSDAO_SAFE_ADDRESS,
  [`event SafeReceived(address indexed sender, uint256 value)`],
  provider,
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const snapshot = readFromSnapshot();
  console.log(`Snapshot has ${Object.keys(snapshot).length} entries.`);

  const fromBlock = getNextBlock();
  const toBlock = AUCTION_ENDED_IN_BLOCK;

  console.log(`Snapshotting from ${fromBlock} to ${toBlock}`);
  const filter = safe.filters.SafeReceived();

  const handleContribution = (sender: string, value: ethers.BigNumber) => {
    console.log(`${sender} sent ${formatEther(value)} ETH`);
    snapshot[sender] = (snapshot[sender] ?? ethers.BigNumber.from(0)).add(value);
  };

  const handleEvent = (event: ethers.Event) => {
    if (!event.args?.sender || !event.args?.value) {
      console.log(`Invalid event??`, event);
      return;
    }
    if (EXCLUDE_TRANSACTIONS[event.transactionHash]) {
      console.log('Exluding transaction', event.transactionHash);
      return;
    }
    if (KNOWN_MISSING_TRANSACTIONS[event.transactionHash]) {
      console.log('!!! FOUND KNOWN MISSING !!!', event.transactionHash);
    }

    const sender = CEX_OVERRIDES[event.transactionHash] ?? (event.args.sender as string);
    const value = event.args.value as ethers.BigNumber;

    if (CEX_OVERRIDES[event.transactionHash]) {
      console.log(
        `remapping tx ${event.transactionHash} for ${ethers.utils.formatEther(value)} ETH from ${
          event.args.sender
        } to ${CEX_OVERRIDES[event.transactionHash]}`,
      );
    }

    handleContribution(sender, value);
  };

  for (let i = fromBlock; i <= toBlock; i = i + BLOCKS_PER_CHUNK) {
    const fromChunkNumber = i;
    const toChunkNumber = Math.min(fromChunkNumber + BLOCKS_PER_CHUNK - 1, toBlock);

    console.log(`checking in ${fromChunkNumber} => ${toChunkNumber}...`);

    try {
      const events = await safe.queryFilter(filter, fromChunkNumber, toChunkNumber);
      console.log(`got ${events.length} events in this set of blocks`);
      events.filter(Boolean).forEach(handleEvent);

      console.log(`setting next to ${toChunkNumber + 1}`);
      setNextBlock(toChunkNumber + 1);

      await sleep(2000);
    } catch (error) {
      console.error(error);
      break;
    }
  }

  console.log('writing to snapshot.csv');
  writeToSnapshot(snapshot);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
