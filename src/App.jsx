import React, { useState, useEffect } from 'react';
import { 
  openWalletModal, 
  fetchVaultState, 
  submitVaultAction, 
  fetchLiveEvents, 
  VAULT_CONTRACT_ID, 
  REWARD_TOKEN_ID 
} from './lib/soroban';
import confetti from 'canvas-confetti';

export function App() {
  const [wallet, setWallet] = useState(null);
  const [activeTab, setActiveTab] = useState('deposit');
  const [amount, setAmount] = useState('100');
  const [totalPool, setTotalPool] = useState('0');
  const [userDeposit, setUserDeposit] = useState('0');
  const [userReward, setUserReward] = useState('0');
  const [txStatus, setTxStatus] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [events, setEvents] = useState([]);
  const [errorModal, setErrorModal] = useState(null);

  const formatTokenAmount = (val) => {
    try {
      const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
      return isNaN(num) ? '0' : num.toLocaleString();
    } catch (e) {
      return '0';
    }
  };

  const shorten = (val, left = 6, right = 4) => {
    try {
      if (val === null || val === undefined) return 'On-Chain';
      const str = typeof val === 'string' ? val : String(val);
      if (str.length <= left + right) return str || 'On-Chain';
      return `${str.slice(0, left)}...${str.slice(-right)}`;
    } catch (e) {
      return 'On-Chain';
    }
  };

  const loadState = async (addr) => {
    try {
      const state = await fetchVaultState(addr);
      if (!state.error && state) {
        setTotalPool(String(state.totalPool || '0'));
        setUserDeposit(String(state.userDeposit || '0'));
        setUserReward(String(state.userReward || '0'));
      }
    } catch (err) {
      console.warn('Silent fallback on state load:', err);
    }
  };

  const loadEvents = async () => {
    try {
      const evs = await fetchLiveEvents();
      if (evs && evs.length > 0) {
        setEvents(evs);
      }
    } catch (err) {
      console.warn('Silent fallback on event load:', err);
    }
  };

  useEffect(() => {
    loadState(wallet);
    loadEvents();
    const interval = setInterval(() => {
      loadState(wallet);
      loadEvents();
    }, 10000);
    return () => clearInterval(interval);
  }, [wallet]);

  const handleConnect = async () => {
    const { publicKey, error } = await openWalletModal();
    if (error) {
      setErrorModal(error);
    } else if (publicKey) {
      setWallet(publicKey);
      loadState(publicKey);
    }
  };

  const handleAction = async (e) => {
    e.preventDefault();
    if (!wallet) {
      await handleConnect();
      return;
    }
    try {
      setTxStatus('PREPARING');
      setTxHash(null);
      await submitVaultAction(activeTab, wallet, amount, (status, hash, err) => {
        setTxStatus(status);
        if (hash) setTxHash(hash);
        if (err) setErrorModal(err);
      });
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      setTimeout(() => {
        loadState(wallet);
        loadEvents();
      }, 3000);
    } catch (err) {
      if (!errorModal) {
        setErrorModal({ 
          type: err.type || 'CONTRACT_ERROR', 
          message: err.message || 'Action rejected or failed during Soroban execution.' 
        });
      }
      setTxStatus(null);
    }
  };

  return (
    <div className="container">
      {/* Navigation */}
      <nav className="navbar">
        <div className="brand">
          <h1>Stellar Vault & Reward Protocol</h1>
          <span className="badge-orange">🟠 Orange Belt</span>
        </div>
        <div>
          {wallet ? (
            <button className="btn-primary" style={{ background: '#0fa37f', color: '#fff' }}>
              🟢 Connected: {shorten(wallet, 5, 4)}
            </button>
          ) : (
            <button className="btn-primary" onClick={handleConnect} data-testid="connect-wallet">
              ⚡ Connect Multi-Wallet
            </button>
          )}
        </div>
      </nav>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* State Card */}
        <div className="glass-card">
          <h2 className="card-title">🌐 On-Chain Protocol State</h2>
          
          <div className="stat-box">
            <span className="stat-label">Total Staked Vault Pool</span>
            <div className="stat-value">
              {formatTokenAmount(totalPool)} <span className="stat-unit">XLM</span>
            </div>
          </div>

          <div className="stat-box" style={{ borderColor: 'rgba(0, 242, 254, 0.3)' }}>
            <span className="stat-label">Your Staked Balance</span>
            <div className="stat-value" style={{ color: '#fff' }}>
              {formatTokenAmount(userDeposit)} <span className="stat-unit">XLM</span>
            </div>
          </div>

          <div className="stat-box" style={{ background: 'linear-gradient(135deg, rgba(0,242,254,0.05), rgba(79,172,254,0.1))', borderColor: '#4facfe' }}>
            <span className="stat-label">✨ Inter-Contract Loyalty Rewards</span>
            <div className="stat-value">
              {formatTokenAmount(userReward)} <span className="stat-unit">RWD</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              *Minted automatically across Soroban smart contract boundaries upon deposit (50% bonus ratio).
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem', fontFamily: 'JetBrains Mono' }}>
            Vault ID: {shorten(VAULT_CONTRACT_ID, 8, 8)}<br/>
            Reward ID: {shorten(REWARD_TOKEN_ID, 8, 8)}
          </div>
        </div>

        {/* Action Card */}
        <div className="glass-card">
          <h2 className="card-title">⚙️ Interactive Protocol Execution</h2>
          
          <div className="tab-container">
            <button 
              type="button"
              className={`tab-btn ${activeTab === 'deposit' ? 'active' : ''}`}
              onClick={() => setActiveTab('deposit')}
            >
              Deposit & Mint RWD
            </button>
            <button 
              type="button"
              className={`tab-btn ${activeTab === 'withdraw' ? 'active' : ''}`}
              onClick={() => setActiveTab('withdraw')}
            >
              Withdraw Staked XLM
            </button>
          </div>

          <form onSubmit={handleAction}>
            <div className="input-group">
              <label className="input-label">
                {activeTab === 'deposit' ? 'Deposit Liquidity Amount (XLM)' : 'Withdraw Liquidity Amount (XLM)'}
              </label>
              <input 
                type="number" 
                min="1" 
                className="styled-input" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500"
                required
              />
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                🔒 Dynamic randomized <code>tx_id: u32</code> parameter generated automatically per request to prevent Mainnet state collisions.
              </span>
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={txStatus && txStatus !== 'SUCCESS' && txStatus !== 'ERROR'}
            >
              {txStatus ? `Processing (${txStatus})...` : activeTab === 'deposit' ? 'Execute Deposit + Inter-Contract Mint' : 'Execute Vault Withdrawal'}
            </button>
          </form>

          {txStatus && (
            <div className={`status-bar ${txStatus === 'SUCCESS' ? 'status-success' : 'status-active'}`}>
              <span>Status: {txStatus}</span>
              {txHash && (
                <a 
                  href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#00f2fe', fontWeight: 700 }}
                >
                  View TX Proof ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live Event Feed */}
      <div className="glass-card">
        <h2 className="card-title">📡 Live On-Chain Soroban Event Feed (Inter-Contract Stream)</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Real-time event synchronization streaming directly from Stellar Testnet consensus across both Vault and Reward Token smart contracts.
        </p>

        <div className="events-table-wrapper">
          <table className="events-table">
            <thead>
              <tr>
                <th>Contract Origin</th>
                <th>Event Symbol</th>
                <th>Target Account</th>
                <th>Transaction Payload</th>
              </tr>
            </thead>
            <tbody>
              {events && events.length > 0 ? (
                events.map((ev, index) => {
                  const isMint = String(ev.contractId) === REWARD_TOKEN_ID;
                  return (
                    <tr key={index}>
                      <td>
                        <span style={{ color: isMint ? '#00f2fe' : '#10b981', fontWeight: 700 }}>
                          {isMint ? 'Reward Token (Contract A)' : 'Staking Vault (Contract B)'}
                        </span>
                        <br/>
                        <code style={{ fontSize: '0.75rem', color: '#64748b' }}>{shorten(ev.contractId, 8, 4)}</code>
                      </td>
                      <td>
                        <span className={`event-type ${isMint ? 'type-mint' : 'type-deposit'}`}>
                          {ev.symbol || (isMint ? 'MINT_REWARD' : 'VAULT_DEPOSIT')}
                        </span>
                      </td>
                      <td><code>{shorten(ev.target, 6, 4)}</code></td>
                      <td>
                        <code>{String(ev.payload || 'Confirmed')}</code>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Listening for live Testnet transactions... Connect wallet above and initiate a deposit to publish events to this stream!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Remediation Modal (Mandatory Bootcamp Error States) */}
      {errorModal && (
        <div className="error-modal-backdrop">
          <div className="error-modal">
            <span className="error-icon">
              {errorModal.type === 'WALLET_NOT_FOUND' ? '🔍' : errorModal.type === 'USER_REJECTED' ? '⚠️' : '🛡️'}
            </span>
            <h3 className="error-title">
              {errorModal.type === 'WALLET_NOT_FOUND' && 'Wallet Provider Notice'}
              {errorModal.type === 'USER_REJECTED' && 'Signature Action Cancelled'}
              {errorModal.type === 'CONTRACT_ERROR' && 'On-Chain Execution Boundary'}
              {!['WALLET_NOT_FOUND', 'USER_REJECTED', 'CONTRACT_ERROR'].includes(errorModal.type) && 'Protocol Notice'}
            </h3>
            <p className="error-message">
              {errorModal.message || (typeof errorModal === 'object' ? JSON.stringify(errorModal, (k, v) => typeof v === 'bigint' ? v.toString() : v) : String(errorModal))}
            </p>
            <button className="btn-dismiss" onClick={() => setErrorModal(null)}>
              Dismiss Notice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
