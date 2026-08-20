import { render, screen } from '@testing-library/react';
import React from 'react';
import { App } from './App';
import { describe, test, expect, vi } from 'vitest';

// Mock Soroban logic to isolate React UI component tests from browser wallet extension dependencies
vi.mock('./lib/soroban', () => ({
  openWalletModal: vi.fn().mockResolvedValue({ publicKey: 'GABR67Q2BNCKF2EIGZEHEAR5KVJQG6IANPKFZHJ32HBGWILDG6LLOUPL', error: null }),
  fetchVaultState: vi.fn().mockResolvedValue({ totalPool: '10000', userDeposit: '500', userReward: '250' }),
  submitVaultAction: vi.fn(),
  fetchLiveEvents: vi.fn().mockResolvedValue([
    { contractId: 'CCGCCYDHVUHZ5CQASVL2JHCMXE6D3R7DDCEVODGKUBBXBXQPJQTJIHWK', symbol: 'mint', target: 'GBUGB...G4E', payload: '2500' },
    { contractId: 'CBHZYTE522C5AX5ZLPDQD34M5MPKSF5ZVL6O32GKMWBCIXUHSFXPVRYJ', symbol: 'deposit', target: 'GBUGB...G4E', payload: '5000' }
  ]),
  VAULT_CONTRACT_ID: 'CBHZYTE522C5AX5ZLPDQD34M5MPKSF5ZVL6O32GKMWBCIXUHSFXPVRYJ',
  REWARD_TOKEN_ID: 'CCGCCYDHVUHZ5CQASVL2JHCMXE6D3R7DDCEVODGKUBBXBXQPJQTJIHWK'
}));

describe('Orange Belt dApp Production Frontend Tests', () => {
  test('Renders standard protocol navbar and title correctly', () => {
    render(<App />);
    expect(screen.getByText(/Stellar Vault & Reward Protocol/i)).toBeInTheDocument();
    expect(screen.getByText(/Orange Belt/i)).toBeInTheDocument();
  });

  test('Renders multi-wallet connection interactive button', () => {
    render(<App />);
    const connectBtn = screen.getByTestId('connect-wallet');
    expect(connectBtn).toBeInTheDocument();
    expect(connectBtn).toHaveTextContent('Connect Multi-Wallet');
  });

  test('Displays inter-contract loyalty rewards accumulator card', () => {
    render(<App />);
    expect(screen.getByText(/Inter-Contract Loyalty Rewards/i)).toBeInTheDocument();
  });

  test('Renders real-time Soroban live event stream table', () => {
    render(<App />);
    expect(screen.getByText(/Live On-Chain Soroban Event Feed/i)).toBeInTheDocument();
  });
});
