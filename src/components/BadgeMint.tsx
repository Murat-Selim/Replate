'use client';

import {
    Transaction,
    TransactionButton,
    TransactionStatus,
    TransactionStatusAction,
    TransactionStatusLabel
} from '@coinbase/onchainkit/transaction';
import { type Address } from 'viem';

// ABI for minting - simplified
const abi = [
    {
        inputs: [
            { name: 'user', type: 'address' },
            { name: 'tokenURI', type: 'string' }
        ],
        name: 'mintBadge',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

export default function BadgeMint({ userAddress }: { userAddress: Address }) {
    // Placeholder contract address - user will need to replace this after deployment
    const contractAddress: Address = '0x0000000000000000000000000000000000000000';

    const calls = [{
        address: contractAddress,
        abi: abi,
        functionName: 'mintBadge',
        args: [userAddress, 'https://replate.app/metadata/novice.json'],
    }];

    return (
        <div className="flex flex-col gap-2 w-full">
            <Transaction
                calls={calls}
                onSuccess={(response: object) => {
                    console.log('Mint success', response);
                }}
                onError={(err) => {
                    console.error('Mint error', err);
                }}
            >
                <TransactionButton
                    className="w-full bg-accent text-white p-4 rounded-[2rem] font-black shadow-lg shadow-accent/20 hover:bg-accent-light transition-all transform active:scale-95 flex items-center justify-center gap-2"
                    text="Claim Novice Badge"
                />
                <TransactionStatus>
                    <TransactionStatusLabel className="text-xs font-bold text-primary text-center mt-2" />
                    <TransactionStatusAction className="text-xs font-black text-accent uppercase tracking-widest text-center" />
                </TransactionStatus>
            </Transaction>
        </div>
    );
}
