import { BigNumber } from '@ethersproject/bignumber';

export const CEX_OVERRIDES: Record<string, string> = {};

// Exclude both the failed and successful auction refunds
export const EXCLUDE_TRANSACTIONS = new Set([
  '0x4bb822a185646228ae2faceac3410874475c33be6a9fcb2519d02f0b740813e6',
  '0x808f47ab1ac458f3cfca391b435f5bea119daf106fdb24a65c48d773c4c36732',
]);

export const KNOWN_MISSING_TRANSACTIONS = new Set([]);

export const MANUAL_OVERRIDES: Record<string, BigNumber> = {};

export const KNOWN_CEX_ADDRESSES = [
  '0xd24400ae8bfebb18ca49be86258a3c749cf46853',
  '0xeb2629a2734e272bcc07bda959863f316f4bd4cf',
  '0xa7efae728d2936e78bda97dc267687568dd593f3',
  '0x4976a4a02f38326660d17bf34b431dc6e2eb2327',
  '0x4ad64983349c49defe8d7a4686202d24b25d0ce8',
];
