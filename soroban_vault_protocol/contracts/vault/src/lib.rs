#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Val, Vec, IntoVal};

#[cfg(test)]
mod test;

#[contract]
pub struct VaultContract;

#[contracttype]
pub enum DataKey {
    UserDeposit(Address),
    TotalPool,
    RewardToken,
}

#[contractimpl]
impl VaultContract {
    /// Initializes the staking vault and stores the companion Reward Token contract address for inter-contract calls.
    pub fn initialize(env: Env, reward_token: Address) {
        if env.storage().instance().has(&DataKey::RewardToken) {
            panic!("Vault already initialized");
        }
        env.storage().instance().set(&DataKey::RewardToken, &reward_token);
        env.storage().instance().set(&DataKey::TotalPool, &0_i128);
    }

    /// Deposits funds into the vault and executes an INTER-CONTRACT CALL to mint reward tokens to the depositor.
    /// Requires dynamic tx_id parameter to prevent state collisions on Mainnet.
    pub fn deposit(env: Env, user: Address, amount: i128, tx_id: u32) -> i128 {
        user.require_auth();
        if amount <= 0 {
            panic!("Deposit amount must be positive");
        }

        // Update individual user balance in persistent storage
        let user_bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserDeposit(user.clone()))
            .unwrap_or(0);
        let new_user_bal = user_bal + amount;
        env.storage()
            .persistent()
            .set(&DataKey::UserDeposit(user.clone()), &new_user_bal);

        // Update total pooled liquidity in instance storage
        let pool_total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalPool)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalPool, &(pool_total + amount));

        // --- INTER-CONTRACT COMMUNICATION ---
        // Automatically call companion contract to mint 50% reward token bonus to user
        if let Some(reward_addr) = env.storage().instance().get::<_, Address>(&DataKey::RewardToken) {
            let reward_qty = amount / 2;
            if reward_qty > 0 {
                let args: Vec<Val> = (user.clone(), reward_qty).into_val(&env);
                env.invoke_contract::<Val>(&reward_addr, &Symbol::new(&env, "mint_reward"), args);
            }
        }

        // Emit live RPC event
        env.events()
            .publish((symbol_short!("deposit"), user), (amount, tx_id));

        new_user_bal
    }

    /// Withdraws staked liquidity from the vault.
    pub fn withdraw(env: Env, user: Address, amount: i128, tx_id: u32) -> i128 {
        user.require_auth();
        if amount <= 0 {
            panic!("Withdraw amount must be positive");
        }

        let user_bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::UserDeposit(user.clone()))
            .unwrap_or(0);
        if user_bal < amount {
            panic!("Insufficient staked vault balance");
        }

        let new_user_bal = user_bal - amount;
        env.storage()
            .persistent()
            .set(&DataKey::UserDeposit(user.clone()), &new_user_bal);

        let pool_total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalPool)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalPool, &(pool_total - amount));

        env.events()
            .publish((symbol_short!("withdraw"), user), (amount, tx_id));

        new_user_bal
    }

    /// Accessor: returns account staking balance.
    pub fn get_balance(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::UserDeposit(user))
            .unwrap_or(0)
    }

    /// Accessor: returns total pooled liquidity across all users.
    pub fn get_total(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalPool)
            .unwrap_or(0)
    }
}
