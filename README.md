# DigiLease

A blockchain-powered rental management platform that creates transparent, enforceable, and trustless lease agreements — all on-chain.

---

## Overview

**DigiLease** is a decentralized application (dApp) designed to improve the rental experience for landlords and tenants. It eliminates the risk of rental fraud, ensures enforceable lease terms, and automates key processes like rent payments, security deposits, maintenance tracking, and dispute resolution.

DigiLease consists of five core smart contracts that together enable a secure and fair rental ecosystem:

1. **Rental Agreement Contract** – Creates, tracks, and enforces rental lease agreements.
2. **Escrow Vault Contract** – Holds and releases security deposits and rent payments.
3. **Property Registry Contract** – Ensures landlord ownership and prevents property fraud.
4. **Maintenance Log Contract** – Tracks issue reports and repair requests throughout a lease.
5. **Dispute Resolver Contract** – Enables arbitration for lease-related disagreements.

---

## Features

- **Digitally enforceable rental contracts** with built-in rules  
- **On-chain escrow** for rent and deposit holding  
- **Verified property registry** to prevent fraud  
- **Transparent maintenance logs** shared between parties  
- **Trustless dispute resolution** for conflict handling  
- **Tenant and landlord reputations** (future upgrade)  

---

## Smart Contracts

### Rental Agreement Contract
- Propose, accept, or terminate rental agreements
- Track lease status (draft, active, terminated)
- Manage metadata like rent amount, duration, and roles

### Escrow Vault Contract
- Secure rent and deposit holding
- Enforce time-based or condition-based releases
- Claimable deposit for damages or violations

### Property Registry Contract
- Register and verify property ownership
- Prevent double listings and impersonation
- Enable transfer or delegation of property rights

### Maintenance Log Contract
- Log repair requests and resolution updates
- Keep audit trail of maintenance activity
- Optional integration with third-party verifiers

### Dispute Resolver Contract
- Raise disputes with evidence submission
- DAO or stake-based resolution process
- Final decisions trigger escrow actions

---

## Installation

1. Install [Clarinet CLI](https://docs.hiro.so/clarinet/getting-started)
2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/digilease.git
   ```
3. Run tests:
    ```bash
    npm test
    ```
4. Deploy contracts:
    ```bash
    clarinet deploy
    ```

---

## Usage

Each contract can operate independently but is designed for seamless integration:

- Start by verifying property ownership.
- Landlord proposes a rental agreement.
- Tenant accepts, triggering escrow deposit.
- Rent payments occur on schedule.
- Maintenance issues and disputes are handled on-chain.

> Refer to the /contracts and /tests folders for implementation and usage details.

---

## License

MIT License