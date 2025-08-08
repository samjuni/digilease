import { describe, it, expect, beforeEach } from "vitest";

interface EscrowBalance {
  deposit: bigint;
  rent: bigint;
}

interface MockContract {
  admin: string;
  rentalAgreement: string;
  escrowBalances: Map<string, EscrowBalance>;
  disputeLocks: Map<bigint, boolean>;
  isAdmin(caller: string): boolean;
  setRentalAgreement(caller: string, contract: string): { value: boolean } | { error: number };
  deposit(caller: string, agreementId: bigint, amount: bigint): { value: boolean } | { error: number };
  recordRentPayment(caller: string, agreementId: bigint, amount: bigint): { value: boolean } | { error: number };
  releaseDeposit(caller: string, agreementId: bigint, recipient: string): { value: boolean } | { error: number };
  refundDeposit(caller: string, agreementId: bigint, recipient: string): { value: boolean } | { error: number };
  releaseRent(caller: string, agreementId: bigint, recipient: string): { value: boolean } | { error: number };
  lockFunds(caller: string, agreementId: bigint): { value: boolean } | { error: number };
  unlockFunds(caller: string, agreementId: bigint): { value: boolean } | { error: number };
  getEscrowBalance(agreementId: bigint, user: string): { value: EscrowBalance };
  getDisputeLock(agreementId: bigint): { value: boolean };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  rentalAgreement: "ST2CY5...",
  escrowBalances: new Map(),
  disputeLocks: new Map(),
  isAdmin(caller: string) {
    return caller === this.admin;
  },
  setRentalAgreement(caller: string, contract: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (contract === "SP000000000000000000002Q6VF78") return { error: 105 };
    this.rentalAgreement = contract;
    return { value: true };
  },
  deposit(caller: string, agreementId: bigint, amount: bigint) {
    if (amount <= 0n) return { error: 101 };
    if (this.disputeLocks.get(agreementId)) return { error: 108 };
    // Mock agreement and party check
    if (agreementId === 0n || (caller !== "ST3NB..." && caller !== "ST4PF...")) return { error: 106 };
    const key = `${agreementId}-${caller}`;
    const current = this.escrowBalances.get(key) || { deposit: 0n, rent: 0n };
    this.escrowBalances.set(key, { deposit: current.deposit + amount, rent: current.rent });
    return { value: true };
  },
  recordRentPayment(caller: string, agreementId: bigint, amount: bigint) {
    if (amount <= 0n) return { error: 101 };
    if (this.disputeLocks.get(agreementId)) return { error: 108 };
    if (agreementId === 0n || (caller !== "ST3NB..." && caller !== "ST4PF...")) return { error: 106 };
    const key = `${agreementId}-${caller}`;
    const current = this.escrowBalances.get(key) || { deposit: 0n, rent: 0n };
    this.escrowBalances.set(key, { deposit: current.deposit, rent: current.rent + amount });
    return { value: true };
  },
  releaseDeposit(caller: string, agreementId: bigint, recipient: string) {
    if (agreementId === 0n || (caller !== "ST3NB..." && caller !== "ST4PF...")) return { error: 106 };
    if (this.disputeLocks.get(agreementId)) return { error: 108 };
    const key = `${agreementId}-${recipient}`;
    const current = this.escrowBalances.get(key);
    if (!current || current.deposit <= 0n) return { error: 102 };
    this.escrowBalances.set(key, { deposit: 0n, rent: current.rent });
    return { value: true };
  },
  refundDeposit(caller: string, agreementId: bigint, recipient: string) {
    if (agreementId === 0n || (caller !== "ST3NB..." && caller !== "ST4PF...")) return { error: 106 };
    if (this.disputeLocks.get(agreementId)) return { error: 108 };
    const key = `${agreementId}-${recipient}`;
    const current = this.escrowBalances.get(key);
    if (!current || current.deposit <= 0n) return { error: 102 };
    this.escrowBalances.set(key, { deposit: 0n, rent: current.rent });
    return { value: true };
  },
  releaseRent(caller: string, agreementId: bigint, recipient: string) {
    if (agreementId === 0n || (caller !== "ST3NB..." && caller !== "ST4PF...")) return { error: 106 };
    if (this.disputeLocks.get(agreementId)) return { error: 108 };
    const key = `${agreementId}-${recipient}`;
    const current = this.escrowBalances.get(key);
    if (!current || current.rent <= 0n) return { error: 102 };
    this.escrowBalances.set(key, { deposit: current.deposit, rent: 0n });
    return { value: true };
  },
  lockFunds(caller: string, agreementId: bigint) {
    if (agreementId === 0n || (caller !== "ST3NB..." && caller !== "ST4PF...")) return { error: 106 };
    if (this.disputeLocks.get(agreementId)) return { error: 103 };
    this.disputeLocks.set(agreementId, true);
    return { value: true };
  },
  unlockFunds(caller: string, agreementId: bigint) {
    if (agreementId === 0n || (caller !== "ST3NB..." && caller !== "ST4PF...")) return { error: 106 };
    if (!this.disputeLocks.get(agreementId)) return { error: 104 };
    this.disputeLocks.set(agreementId, false);
    return { value: true };
  },
  getEscrowBalance(agreementId: bigint, user: string) {
    const key = `${agreementId}-${user}`;
    return { value: this.escrowBalances.get(key) || { deposit: 0n, rent: 0n } };
  },
  getDisputeLock(agreementId: bigint) {
    return { value: this.disputeLocks.get(agreementId) || false };
  }
};

describe("EscrowVault Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.rentalAgreement = "ST2CY5...";
    mockContract.escrowBalances = new Map();
    mockContract.disputeLocks = new Map();
  });

  it("should allow admin to set rental agreement contract", () => {
    const result = mockContract.setRentalAgreement(mockContract.admin, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.rentalAgreement).toBe("ST3NB...");
  });

  it("should allow valid deposit", () => {
    const result = mockContract.deposit("ST3NB...", 1n, 1000n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const balance = mockContract.getEscrowBalance(1n, "ST3NB...").value;
      expect(balance).toEqual({ deposit: 1000n, rent: 0n });
    }
  });

  it("should allow valid rent payment", () => {
    const result = mockContract.recordRentPayment("ST3NB...", 1n, 500n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const balance = mockContract.getEscrowBalance(1n, "ST3NB...").value;
      expect(balance).toEqual({ deposit: 0n, rent: 500n });
    }
  });

  it("should allow deposit release to landlord", () => {
    mockContract.deposit("ST3NB...", 1n, 1000n);
    const result = mockContract.releaseDeposit("ST3NB...", 1n, "ST3NB...");
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const balance = mockContract.getEscrowBalance(1n, "ST3NB...").value;
      expect(balance).toEqual({ deposit: 0n, rent: 0n });
    }
  });

  it("should allow deposit refund to tenant", () => {
    mockContract.deposit("ST3NB...", 1n, 1000n);
    const result = mockContract.refundDeposit("ST3NB...", 1n, "ST3NB...");
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const balance = mockContract.getEscrowBalance(1n, "ST3NB...").value;
      expect(balance).toEqual({ deposit: 0n, rent: 0n });
    }
  });

  it("should allow rent release to landlord", () => {
    mockContract.recordRentPayment("ST3NB...", 1n, 500n);
    const result = mockContract.releaseRent("ST3NB...", 1n, "ST3NB...");
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const balance = mockContract.getEscrowBalance(1n, "ST3NB...").value;
      expect(balance).toEqual({ deposit: 0n, rent: 0n });
    }
  });

  it("should allow locking funds during dispute", () => {
    const result = mockContract.lockFunds("ST3NB...", 1n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const lock = mockContract.getDisputeLock(1n).value;
      expect(lock).toBe(true);
    }
  });

  it("should allow unlocking funds after dispute", () => {
    mockContract.lockFunds("ST3NB...", 1n);
    const result = mockContract.unlockFunds("ST3NB...", 1n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const lock = mockContract.getDisputeLock(1n).value;
      expect(lock).toBe(false);
    }
  });

  it("should prevent deposit when dispute is active", () => {
    mockContract.lockFunds("ST3NB...", 1n);
    const result = mockContract.deposit("ST3NB...", 1n, 1000n);
    expect(result).toEqual({ error: 108 });
  });

  it("should prevent release when no funds", () => {
    const result = mockContract.releaseDeposit("ST3NB...", 1n, "ST3NB...");
    expect(result).toEqual({ error: 102 });
  });
});