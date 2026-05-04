import { createSiweMessage, generateSiweNonce } from 'viem/siwe';
import { useAccount, usePublicClient, useSignMessage } from 'wagmi';

export function useSignIn() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();

  async function signIn() {
    if (!isConnected || !address || !chainId || !publicClient) return;

    const nonce = generateSiweNonce();
    const message = createSiweMessage({
      address,
      chainId,
      domain: window.location.host,
      nonce,
      uri: window.location.origin,
      version: '1',
    });

    const signature = await signMessageAsync({ message });
    const valid = await publicClient.verifySiweMessage({ message, signature });
    if (!valid) throw new Error('SIWE verification failed');

    return { address, signature };
  }

  return { signIn };
}
