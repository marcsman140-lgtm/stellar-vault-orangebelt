#![cfg(test)]
use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Env, Address};
use reward_token_contract::{RewardTokenContract, RewardTokenContractClient};

fn setup_test() -> (Env, VaultContractClient<'static>, RewardTokenContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Deploy companion reward token contract using SDK v27 register pattern
    let token_id = env.register(RewardTokenContract, ());
    let token_client = RewardTokenContractClient::new(&env, &token_id);
    token_client.initialize(&admin);

    // Deploy vault staking contract
    let vault_id = env.register(VaultContract, ());
    let vault_client = VaultContractClient::new(&env, &vault_id);
    vault_client.initialize(&token_id);

    (env, vault_client, token_client, admin, user)
}

#[test]
fn test_vault_deposit_with_intercontract_reward_mint() {
    let (_, vault, token, _, user) = setup_test();

    // Deposit 1000 units into vault with dynamic tx_id 1001
    let new_bal = vault.deposit(&user, &1000_i128, &1001_u32);
    assert_eq!(new_bal, 1000);
    assert_eq!(vault.get_balance(&user), 1000);
    assert_eq!(vault.get_total(), 1000);

    // VERIFY INTER-CONTRACT COMMUNICATION:
    // Vault automatically called reward_token contract across Wasm boundaries to mint 50% reward ratio (500 tokens)
    let reward_bal = token.balance_of(&user);
    assert_eq!(reward_bal, 500);
    assert_eq!(token.total_supply(), 500);
}

#[test]
fn test_vault_multi_user_staking_and_accumulation() {
    let (env, vault, token, _, user1) = setup_test();
    let user2 = Address::generate(&env);

    vault.deposit(&user1, &2000_i128, &2001_u32);
    vault.deposit(&user2, &4000_i128, &2002_u32);

    assert_eq!(vault.get_balance(&user1), 2000);
    assert_eq!(vault.get_balance(&user2), 4000);
    assert_eq!(vault.get_total(), 6000);

    // Check individual loyalty rewards minted across contracts
    assert_eq!(token.balance_of(&user1), 1000);
    assert_eq!(token.balance_of(&user2), 2000);
    assert_eq!(token.total_supply(), 3000);
}

#[test]
fn test_vault_withdraw_flow_and_events() {
    let (_, vault, _, _, user) = setup_test();

    vault.deposit(&user, &3000_i128, &3001_u32);
    assert_eq!(vault.get_total(), 3000);

    let remain_bal = vault.withdraw(&user, &1200_i128, &3002_u32);
    assert_eq!(remain_bal, 1800);
    assert_eq!(vault.get_balance(&user), 1800);
    assert_eq!(vault.get_total(), 1800);
}

#[test]
#[should_panic(expected = "Insufficient staked vault balance")]
fn test_vault_overdraw_protection() {
    let (_, vault, _, _, user) = setup_test();
    vault.deposit(&user, &500_i128, &4001_u32);
    // Attempting to withdraw more than deposited must panic
    vault.withdraw(&user, &1000_i128, &4002_u32);
}

#[test]
#[should_panic(expected = "Deposit amount must be positive")]
fn test_vault_zero_deposit_rejection() {
    let (_, vault, _, _, user) = setup_test();
    vault.deposit(&user, &0_i128, &5001_u32);
}

#[test]
#[should_panic(expected = "Withdraw amount must be positive")]
fn test_vault_zero_withdraw_rejection() {
    let (_, vault, _, _, user) = setup_test();
    vault.deposit(&user, &500_i128, &5002_u32);
    vault.withdraw(&user, &0_i128, &5003_u32);
}
