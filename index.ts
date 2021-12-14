import { ethers } from 'ethers';
import { config } from 'dotenv';

import { Command } from 'commander';
const program = new Command();

import {
  CEX_OVERRIDES,
  EXCLUDE_TRANSACTIONS,
  KNOWN_MISSING_TRANSACTIONS,
} from './lib/transactions';
import {
  AUCTION_ENDED_IN_BLOCK,
  FREEROSSDAO_SAFE_ADDRESS,
  BLOCKS_PER_CHUNK,
  SAFE_DEPLOYED_IN_BLOCK,
} from './lib/const';
import { snapshotFilename, readSnapshot, writeSnapshot } from './lib/io';
config();

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_ENDPOINT as string);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// async function main(startBlock: number, toBlock: number, chunkSize: number) {
//   const snapshot = readFromSnapshot();
//   console.log(`Snapshot has ${Object.keys(snapshot).length} entries.`);

//   const fromBlock = getNextBlock() || startBlock;

//   console.log(`Snapshotting from ${fromBlock} to ${toBlock}`);
//   const filter = safe.filters.SafeReceived();

//   const handleContribution = (sender: string, value: ethers.BigNumber) => {
//     console.log(`${sender} sent ${formatEther(value)} ETH`);
//     snapshot[sender] = (snapshot[sender] ?? ethers.BigNumber.from(0)).add(value);
//   };

//   const handleEvent = (event: ethers.Event) => {
//     if (!event.args?.sender || !event.args?.value) {
//       console.log(`Invalid event??`, event);
//       return;
//     }
//     if (EXCLUDE_TRANSACTIONS[event.transactionHash]) {
//       console.log('Exluding transaction', event.transactionHash);
//       return;
//     }
//     if (KNOWN_MISSING_TRANSACTIONS[event.transactionHash]) {
//       console.log('!!! FOUND KNOWN MISSING !!!', event.transactionHash);
//     }

//     const sender = CEX_OVERRIDES[event.transactionHash] ?? (event.args.sender as string);
//     const value = event.args.value as ethers.BigNumber;

//     if (CEX_OVERRIDES[event.transactionHash]) {
//       console.log(
//         `remapping tx ${event.transactionHash} for ${ethers.utils.formatEther(value)} ETH from ${
//           event.args.sender
//         } to ${CEX_OVERRIDES[event.transactionHash]}`,
//       );
//     }

//     handleContribution(sender, value);
//   };

//   for (let i = fromBlock; i <= toBlock; i = i + chunkSize) {
//     const fromChunkNumber = i;
//     const toChunkNumber = Math.min(fromChunkNumber + chunkSize - 1, toBlock);

//     console.log(`checking in ${fromChunkNumber} => ${toChunkNumber}...`);

//     try {
//       const events = await safe.queryFilter(filter, fromChunkNumber, toChunkNumber);
//       console.log(`got ${events.length} events in this set of blocks`);
//       events.filter(Boolean).forEach(handleEvent);

//       console.log(`setting next to ${toChunkNumber + 1}`);
//       setNextBlock(toChunkNumber + 1);

//       await sleep(2000);
//     } catch (error) {
//       console.error(error);
//       break;
//     }
//   }

//   console.log('writing to snapshot.csv');
//   writeToSnapshot(snapshot);
// }

async function fetchTransactions(
  startBlock: number,
  endBlock: number,
  chunkSize: number,
  contractAddress: string,
) {
  const safe = new ethers.Contract(
    contractAddress,
    [`event SafeReceived(address indexed sender, uint256 value)`],
    provider,
  );
  const filter = safe.filters.SafeReceived();

  const filename = snapshotFilename(startBlock, endBlock, contractAddress);
  const snapshot = readSnapshot(filename);
  const fromBlock = snapshot.currentBlock || startBlock;

  console.log(`Snapshoting from ${fromBlock} to ${endBlock}`);

  const handleEvent = (event: ethers.Event) => {
    if (!event.args?.sender || !event.args?.value) {
      console.log(`Invalid event??`, event);
      return;
    }

    const sender = event.args.sender as string;
    const value = event.args.value as ethers.BigNumber;

    snapshot.transactions[event.transactionHash] = {
      hash: event.transactionHash,
      sender,
      value,
    };
  };

  for (let i = fromBlock; i <= endBlock; i = i + chunkSize) {
    const fromChunkNumber = i;
    const toChunkNumber = Math.min(fromChunkNumber + chunkSize - 1, endBlock);

    console.log(`checking in ${fromChunkNumber} => ${toChunkNumber}...`);

    try {
      const events = await safe.queryFilter(filter, fromChunkNumber, toChunkNumber);
      console.log(`got ${events.length} events in this set of blocks`);
      events.filter(Boolean).forEach(handleEvent);

      snapshot.currentBlock = toChunkNumber + 1;
      console.log(`set next to ${toChunkNumber + 1}`);

      writeSnapshot(filename, snapshot);
      await sleep(1400);
    } catch (error) {
      console.error(error);
      break;
    }
  }

  return snapshot;
}

const parseDec = (n: string) => parseInt(n, 10);

program.version('0.0.1');
program
  .option('-s, --start <block>', 'start block', parseDec, SAFE_DEPLOYED_IN_BLOCK)
  .option('-e, --end <block>', 'end block', parseDec, AUCTION_ENDED_IN_BLOCK)
  .option('--chunk <number>', 'blocks per chunk', parseDec, BLOCKS_PER_CHUNK)
  .option('-a, --address <address>', 'address', FREEROSSDAO_SAFE_ADDRESS);

program.parse(process.argv);

const options = program.opts();

console.log(options);
fetchTransactions(options.start, options.end, options.chunk, options.address)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
