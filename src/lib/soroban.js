import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import * as StellarSdk from '@stellar/stellar-sdk';

export const VAULT_CONTRACT_ID = 'CBHZYTE522C5AX5ZLPDQD34M5MPKSF5ZVL6O32GKMWBCIXUHSFXPVRYJ';
export const REWARD_TOKEN_ID = 'CCGCCYDHVUHZ5CQASVL2JHCMXE6D3R7DDCEVODGKUBBXBXQPJQTJIHWK';
export const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
export const RPC_URL = 'https://soroban-testnet.stellar.org';

const server = new StellarSdk.rpc.Server(RPC_URL);

// Initialize StellarWalletsKit statically per official v2.5+ specs
try {
  StellarWalletsKit.init({
    network: NETWORK_PASSPHRASE,
    selectedWalletId: 'freighter',
    modules: [
      new FreighterModule(),
      new AlbedoModule(),
    ],
  });
} catch (e) {
  console.warn('SWK already initialized:', e);
}

export async function openWalletModal() {
  try {
    const res = await StellarWalletsKit.authModal();
    return { publicKey: res.address, error: null };
  } catch (err) {
    console.error('Wallet modal exception:', err);
    if (err.message?.includes('closed') || err.message?.includes('reject') || err.message?.includes('cancel')) {
      return { publicKey: null, error: { type: 'USER_REJECTED', message: 'You dismissed or rejected the wallet connection modal.' } };
    }
    if (err.message?.includes('not found') || err.message?.includes('not installed') || err.message?.includes('Provider')) {
      return { publicKey: null, error: { type: 'WALLET_NOT_FOUND', message: 'Freighter or Albedo wallet extension is not installed or enabled in this browser.' } };
    }
    return { publicKey: null, error: { type: 'WALLET_NOT_FOUND', message: 'Please ensure Freighter wallet extension is unlocked and set to Testnet.' } };
  }
}

export async function fetchVaultState(userAddress) {
  try {
    let totalPool = '0';
    try {
      const totalTx = new StellarSdk.TransactionBuilder(
        new StellarSdk.Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
        { fee: '100', networkPassphrase: NETWORK_PASSPHRASE }
      )
        .addOperation(
          StellarSdk.Operation.invokeHostFunction({
            func: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(
              new StellarSdk.xdr.InvokeContractArgs({
                contractAddress: StellarSdk.Address.fromString(VAULT_CONTRACT_ID).toScAddress(),
                functionName: 'get_total',
                args: [],
              })
            ),
            auth: [],
          })
        )
        .setTimeout(30)
        .build();

      const totalSim = await server.simulateTransaction(totalTx);
      if (StellarSdk.rpc.Api.isSimulationSuccess(totalSim) && totalSim.result && totalSim.result.retval) {
        const val = StellarSdk.scValToNative(totalSim.result.retval);
        totalPool = String(val || '0');
      }
    } catch (e) {
      console.warn('Error simulating total pool:', e);
    }

    let userDeposit = '0';
    let userReward = '0';
    if (userAddress) {
      try {
        const depTx = new StellarSdk.TransactionBuilder(
          new StellarSdk.Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
          { fee: '100', networkPassphrase: NETWORK_PASSPHRASE }
        )
          .addOperation(
            StellarSdk.Operation.invokeHostFunction({
              func: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(
                new StellarSdk.xdr.InvokeContractArgs({
                  contractAddress: StellarSdk.Address.fromString(VAULT_CONTRACT_ID).toScAddress(),
                  functionName: 'get_balance',
                  args: [new StellarSdk.Address(userAddress).toScVal()],
                })
              ),
              auth: [],
            })
          )
          .setTimeout(30)
          .build();
        const depSim = await server.simulateTransaction(depTx);
        if (StellarSdk.rpc.Api.isSimulationSuccess(depSim) && depSim.result && depSim.result.retval) {
          const nativeDep = StellarSdk.scValToNative(depSim.result.retval);
          userDeposit = String(nativeDep || '0');
        }
      } catch (e) {
        console.warn('Could not read user deposit balance:', e);
      }

      try {
        const rewTx = new StellarSdk.TransactionBuilder(
          new StellarSdk.Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'),
          { fee: '100', networkPassphrase: NETWORK_PASSPHRASE }
        )
          .addOperation(
            StellarSdk.Operation.invokeHostFunction({
              func: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(
                new StellarSdk.xdr.InvokeContractArgs({
                  contractAddress: StellarSdk.Address.fromString(REWARD_TOKEN_ID).toScAddress(),
                  functionName: 'balance_of',
                  args: [new StellarSdk.Address(userAddress).toScVal()],
                })
              ),
              auth: [],
            })
          )
          .setTimeout(30)
          .build();
        const rewSim = await server.simulateTransaction(rewTx);
        if (StellarSdk.rpc.Api.isSimulationSuccess(rewSim) && rewSim.result && rewSim.result.retval) {
          const nativeRew = StellarSdk.scValToNative(rewSim.result.retval);
          userReward = String(nativeRew || '0');
        }
      } catch (e) {
        console.warn('Could not read user reward balance:', e);
      }
    }

    return { totalPool, userDeposit, userReward };
  } catch (err) {
    console.error('Error querying Soroban state:', err);
    return { totalPool: '0', userDeposit: '0', userReward: '0', error: err };
  }
}

export async function submitVaultAction(actionType, userAddress, amountStr, onProgress) {
  try {
    onProgress('PREPARING');
    let sourceAccount;
    try {
      sourceAccount = await server.getAccount(userAddress);
    } catch (e) {
      throw { type: 'CONTRACT_ERROR', message: 'Account not active on Testnet. Please fund your account via Friendbot.' };
    }

    const amountVal = StellarSdk.xdr.ScVal.scvI128(
      new StellarSdk.xdr.Int128Parts({
        hi: new StellarSdk.xdr.Int64(0),
        lo: new StellarSdk.xdr.Uint64(parseInt(amountStr, 10)),
      })
    );
    // Generate dynamic randomized u32 tx_id to prevent state collisions on Mainnet
    const dynamicTxId = Math.floor(Math.random() * 1000000000);
    const txIdVal = StellarSdk.xdr.ScVal.scvU32(dynamicTxId);

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '10000',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.invokeHostFunction({
          func: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(
            new StellarSdk.xdr.InvokeContractArgs({
              contractAddress: StellarSdk.Address.fromString(VAULT_CONTRACT_ID).toScAddress(),
              functionName: actionType, // 'deposit' or 'withdraw'
              args: [new StellarSdk.Address(userAddress).toScVal(), amountVal, txIdVal],
            })
          ),
          auth: [],
        })
      )
      .setTimeout(180)
      .build();

    onProgress('SIMULATING');
    const simRes = await server.simulateTransaction(tx);
    if (!StellarSdk.rpc.Api.isSimulationSuccess(simRes)) {
      console.error('Simulation exception:', simRes);
      throw { type: 'CONTRACT_ERROR', message: `RPC simulation failed: ${simRes.error || 'Check deposit balance or amount limits'}` };
    }

    const preparedTx = await server.prepareTransaction(tx, simRes);
    onProgress('SIGNING');
    
    let signedXdr;
    try {
      const res = await StellarWalletsKit.signTransaction(preparedTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: userAddress,
      });
      signedXdr = typeof res === 'string' ? res : res.signedTxXdr || res.tx;
    } catch (sigErr) {
      throw { type: 'USER_REJECTED', message: 'Transaction signing declined by user.' };
    }

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    onProgress('SUBMITTING');
    const sendRes = await server.sendTransaction(signedTx);

    if (sendRes.status === 'ERROR') {
      throw { type: 'CONTRACT_ERROR', message: `Submission rejected by network: ${JSON.stringify(sendRes.errorResult || 'Unknown network rejection', (k, v) => typeof v === 'bigint' ? v.toString() : v)}` };
    }

    onProgress('PENDING');
    let txResponse = await server.getTransaction(sendRes.hash);
    let retries = 0;
    while (txResponse.status === 'NOT_FOUND' && retries < 20) {
      await new Promise(r => setTimeout(r, 2000));
      txResponse = await server.getTransaction(sendRes.hash);
      retries++;
    }

    if (txResponse.status === 'SUCCESS') {
      onProgress('SUCCESS', sendRes.hash);
      return { success: true, hash: sendRes.hash };
    } else {
      throw { type: 'CONTRACT_ERROR', message: `Transaction failed during consensus: ${txResponse.status}` };
    }
  } catch (error) {
    console.error('Vault operation failed:', error);
    onProgress('ERROR', null, error);
    throw error;
  }
}

export async function fetchLiveEvents() {
  try {
    const latest = await server.getLatestLedger();
    const startLedger = Math.max(1, latest.sequence - 150);
    const eventsResponse = await server.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [VAULT_CONTRACT_ID, REWARD_TOKEN_ID],
        }
      ],
      limit: 15
    });
    const rawEvents = eventsResponse.events || [];
    return rawEvents.map(ev => {
      let sym = 'Action';
      let target = 'Account';
      let payload = 'Confirmed';
      let cId = '';

      try {
        if (typeof ev.contractId === 'string') {
          cId = ev.contractId;
        } else if (ev.contractId && typeof ev.contractId === 'object') {
          cId = ev.contractId.contractId ? String(ev.contractId.contractId) : (ev.contractId.toString ? ev.contractId.toString('hex') : String(ev.contractId));
        } else {
          cId = String(ev.contractId || '');
        }
      } catch (e) {
        cId = 'Contract Event';
      }

      try {
        if (ev.topic && ev.topic.length > 0) {
          try { sym = String(StellarSdk.scValToNative(ev.topic[0])); } catch (e) { sym = 'Call'; }
        }
        if (ev.topic && ev.topic.length > 1) {
          try { target = String(StellarSdk.scValToNative(ev.topic[1])); } catch (e) { target = 'Stellar Account'; }
        }
        if (ev.value) {
          try {
            const nativeVal = StellarSdk.scValToNative(ev.value);
            payload = typeof nativeVal === 'object' 
              ? JSON.stringify(nativeVal, (k, v) => typeof v === 'bigint' ? v.toString() : v) 
              : String(nativeVal);
          } catch (e) {
            payload = 'Success';
          }
        }
      } catch (err) { /* fallback safe values */ }

      return {
        contractId: String(cId),
        symbol: String(sym),
        target: String(target),
        payload: String(payload)
      };
    });
  } catch (err) {
    return [];
  }
}
