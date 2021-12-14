import { ethers } from 'ethers';
import { formatEther } from '@ethersproject/units';
import { config } from 'dotenv';
import _ from 'lodash';

import { Command } from 'commander';
const program = new Command();

import {
  CEX_OVERRIDES,
  EXCLUDE_TRANSACTIONS,
} from './lib/transactions';
import {
  AUCTION_ENDED_IN_BLOCK,
  FREEROSSDAO_SAFE_ADDRESS,
  BLOCKS_PER_CHUNK,
  SAFE_DEPLOYED_IN_BLOCK,
} from './lib/const';
import { snapshotFilename, readSnapshot, writeSnapshot, Snapshot, Transaction, Ledger, writeLedger } from './lib/io';
import { mainModule } from 'process';
config();

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_ENDPOINT as string);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function processSnapshot(snapshot: Snapshot) {
  console.log(`Snapshot has ${Object.keys(snapshot.transactions).length} entries.`);

  const ledger: Ledger = {};

  const handleContribution = (sender: string, value: ethers.BigNumber) => {
    console.log(`${sender} sent ${formatEther(value)} ETH`);
    ledger[sender] = (ledger[sender] ?? ethers.BigNumber.from(0)).add(value);
  };

  const handleTransaction = (transaction: Transaction) => {
    if (EXCLUDE_TRANSACTIONS.has(transaction.hash)) {
      console.log('Exluding transaction', transaction.hash);
      return;
    }

    const overrideAddress = CEX_OVERRIDES[transaction.hash]
    const sender = overrideAddress ?? transaction.sender;
    const value = transaction.value;

    if (overrideAddress) {
      console.log(
        `remapping tx ${transaction.hash} for ${ethers.utils.formatEther(value)} ETH from ${
          transaction.sender
        } to ${overrideAddress}`,
      );
    }

    handleContribution(sender, value);
  };

  _.values(snapshot.transactions).forEach(handleTransaction);

  console.log('writing to snapshot.csv');
  writeLedger('snapshot.csv', ledger);
}

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

async function main(
  startBlock: number,
  endBlock: number,
  chunkSize: number,
  contractAddress: string) {
  const snapshot = await fetchTransactions(startBlock, endBlock, chunkSize, contractAddress);
  processSnapshot(snapshot);
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
main(options.start, options.end, options.chunk, options.address)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
