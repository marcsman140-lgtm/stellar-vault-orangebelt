#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, symbol_short};

#[contract]
pub struct RewardTokenContract;

#[contracttype]
pub enum DataKey {
    Balance(Address),
    TotalSupply,
    Admin,
}

#[contractimpl]
impl RewardTokenContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0_i128);
    }

    /// Mint rewards to a specific user. Can be called by an authorized staking vault via inter-contract call.
    pub fn mint_reward(env: Env, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("Amount must be positive");
        }
        // Update user balance in persistent ledger storage
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        let new_balance = current_balance + amount;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &new_balance);

        // Update total supply accumulator
        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(total + amount));

        // Publish event to live RPC subscription stream
        env.events()
            .publish((symbol_short!("mint"), to), amount);
    }

    pub fn balance_of(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(user))
            .unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }
}
