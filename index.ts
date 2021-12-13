import { ethers } from 'ethers';
import { config } from 'dotenv';
import { formatEther } from '@ethersproject/units';
import { parse, stringify } from 'csv/sync';
import { readFileSync, writeFileSync, existsSync } from 'fs';

import {
  CEX_OVERRIDES,
  EXCLUDE_TRANSACTIONS,
  KNOWN_MISSING_TRANSACTIONS,
} from './lib/transactions';

config();

const SAFE_DEPLOYED_IN_BLOCK = 13724221;
const AUCTION_ENDED_IN_BLOCK = 13770208;
const FREEROSSDAO_SAFE_ADDRESS = '0xc102d2544a7029f7BA04BeB133dEADaA57fDF6b4';
const BLOCKS_PER_CHUNK = 100;
const SNAPSHOT_FILENAME = 'snapshot.csv';
const NEXT_BLOCK_INFO = 'next.json';

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_ENDPOINT as string);
const safe = new ethers.Contract(
  FREEROSSDAO_SAFE_ADDRESS,
  [`event SafeReceived(address indexed sender, uint256 value)`],
  provider,
);

type Snapshot = Record<string, ethers.BigNumber>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readFromSnapshot(): Snapshot {
  if (!existsSync(SNAPSHOT_FILENAME)) return {};

  const data = parse(readFileSync(SNAPSHOT_FILENAME), { columns: true }) as {
    sender: string;
    value: string;
  }[];

  return data.reduce<Snapshot>((memo, { sender, value }) => {
    memo[sender] = ethers.BigNumber.from(value);
    return memo;
  }, {});
}

function writeToSnapshot(snapshot: Snapshot) {
  writeFileSync(
    SNAPSHOT_FILENAME,
    stringify(
      Object.keys(snapshot).map((sender) => ({ sender, value: snapshot[sender].toString() })),
      {
        header: true,
      },
    ),
  );
}

function getNextBlock() {
  if (!existsSync(NEXT_BLOCK_INFO)) return SAFE_DEPLOYED_IN_BLOCK;
  return JSON.parse(readFileSync(NEXT_BLOCK_INFO).toString()).next;
}

function setNextBlock(next: number) {
  writeFileSync(NEXT_BLOCK_INFO, JSON.stringify({ next }));
}

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
