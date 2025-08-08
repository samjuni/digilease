import { describe, it, expect, beforeEach } from "vitest";

interface Agreement {
  landlord: string;
  tenant: string | null;
  propertyId: bigint;
  rentAmount: bigint;
  depositAmount: bigint;
  startDate: bigint;
  endDate: bigint;
  lateFee: bigint;
  status: number;
  createdAt: bigint;
  lastPayment: bigint | null;
}

interface MockContract {
  admin: string;
  escrowVault: string;
  agreements: Map<bigint, Agreement>;
  agreementCounter: Map<string, bigint>;
  blockHeight: bigint;
  isAdmin(caller: string): boolean;
  setEscrowVault(caller: string, vault: string): { value: boolean } | { error: number };
  createAgreement(caller: string, propertyId: bigint, rentAmount: bigint, depositAmount: bigint, startDate: bigint, endDate: bigint, lateFee: bigint): { value: bigint } | { error: number };
  acceptAgreement(caller: string, agreementId: bigint): { value: boolean } | { error: number };
  recordPayment(caller: string, agreementId: bigint): { value: boolean } | { error: number };
  terminateAgreement(caller: string, agreementId: bigint): { value: boolean } | { error: number };
  initiateDispute(caller: string, agreementId: bigint): { value: boolean } | { error: number };
  getAgreement(agreementId: bigint): { value: Agreement } | { error: number };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  escrowVault: "ST2CY5...",
  agreements: new Map(),
  agreementCounter: new Map(),
  blockHeight: 1000n,
  isAdmin(caller: string) {
    return caller === this.admin;
  },
  setEscrowVault(caller: string, vault: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (vault === "SP000000000000000000002Q6VF78") return { error: 109 };
    this.escrowVault = vault;
    return { value: true };
  },
  createAgreement(caller: string, propertyId: bigint, rentAmount: bigint, depositAmount: bigint, startDate: bigint, endDate: bigint, lateFee: bigint) {
    if (rentAmount <= 0n || depositAmount <= 0n) return { error: 102 };
    if (startDate < this.blockHeight || endDate <= startDate) return { error: 106 };
    // Mock property check
    if (propertyId === 0n) return { error: 101 };
    const landlord = caller;
    const agreementId = ((this.agreementCounter.get(landlord) || 0n) + 1n);
    if (this.agreements.has(agreementId)) return { error: 103 };
    this.agreements.set(agreementId, {
      landlord,
      tenant: null,
      propertyId,
      rentAmount,
      depositAmount,
      startDate,
      endDate,
      lateFee,
      status: 0,
      createdAt: this.blockHeight,
      lastPayment: null
    });
    this.agreementCounter.set(landlord, agreementId);
    return { value: agreementId };
  },
  acceptAgreement(caller: string, agreementId: bigint) {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) return { error: 104 };
    if (agreement.status !== 0) return { error: 105 };
    if (agreement.tenant !== null) return { error: 103 };
    agreement.tenant = caller;
    agreement.status = 1;
    this.agreements.set(agreementId, agreement);
    return { value: true };
  },
  recordPayment(caller: string, agreementId: bigint) {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) return { error: 104 };
    if (agreement.status !== 1) return { error: 105 };
    if (agreement.tenant !== caller) return { error: 100 };
    agreement.lastPayment = this.blockHeight;
    this.agreements.set(agreementId, agreement);
    return { value: true };
  },
  terminateAgreement(caller: string, agreementId: bigint) {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) return { error: 104 };
    if (agreement.landlord !== caller && agreement.tenant !== caller) return { error: 100 };
    if (agreement.status !== 1 && agreement.status !== 3) return { error: 105 };
    if (this.blockHeight < agreement.endDate) return { error: 107 };
    agreement.status = 2;
    this.agreements.set(agreementId, agreement);
    return { value: true };
  },
  initiateDispute(caller: string, agreementId: bigint) {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) return { error: 104 };
    if (agreement.landlord !== caller && agreement.tenant !== caller) return { error: 100 };
    if (agreement.status !== 1) return { error: 105 };
    agreement.status = 3;
    this.agreements.set(agreementId, agreement);
    return { value: true };
  },
  getAgreement(agreementId: bigint) {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) return { error: 104 };
    return { value: agreement };
  }
};

describe("RentalAgreement Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.escrowVault = "ST2CY5...";
    mockContract.agreements = new Map();
    mockContract.agreementCounter = new Map();
    mockContract.blockHeight = 1000n;
  });

  it("should allow admin to set escrow vault", () => {
    const result = mockContract.setEscrowVault(mockContract.admin, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.escrowVault).toBe("ST3NB...");
  });

  it("should create agreement with valid parameters", () => {
    const result = mockContract.createAgreement(
      mockContract.admin,
      1n,
      1000n,
      2000n,
      1001n,
      2000n,
      50n
    );
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(1n);
      const agreementResult = mockContract.getAgreement(1n);
      expect("value" in agreementResult).toBe(true);
      if ("value" in agreementResult) {
        expect(agreementResult.value).toEqual({
          landlord: mockContract.admin,
          tenant: null,
          propertyId: 1n,
          rentAmount: 1000n,
          depositAmount: 2000n,
          startDate: 1001n,
          endDate: 2000n,
          lateFee: 50n,
          status: 0,
          createdAt: 1000n,
          lastPayment: null
        });
      }
    }
  });

  it("should prevent creating agreement with invalid property", () => {
    const result = mockContract.createAgreement(
      mockContract.admin,
      0n,
      1000n,
      2000n,
      1001n,
      2000n,
      50n
    );
    expect(result).toEqual({ error: 101 });
  });

  it("should allow tenant to accept agreement", () => {
    mockContract.createAgreement(mockContract.admin, 1n, 1000n, 2000n, 1001n, 2000n, 50n);
    const result = mockContract.acceptAgreement("ST3NB...", 1n);
    expect(result).toEqual({ value: true });
    const agreementResult = mockContract.getAgreement(1n);
    expect("value" in agreementResult).toBe(true);
    if ("value" in agreementResult) {
      expect(agreementResult.value.tenant).toBe("ST3NB...");
      expect(agreementResult.value.status).toBe(1);
    }
  });

  it("should allow tenant to record payment", () => {
    mockContract.createAgreement(mockContract.admin, 1n, 1000n, 2000n, 1001n, 2000n, 50n);
    mockContract.acceptAgreement("ST3NB...", 1n);
    const result = mockContract.recordPayment("ST3NB...", 1n);
    expect(result).toEqual({ value: true });
    const agreementResult = mockContract.getAgreement(1n);
    expect("value" in agreementResult).toBe(true);
    if ("value" in agreementResult) {
      expect(agreementResult.value.lastPayment).toBe(1000n);
    }
  });

  it("should allow termination after end date", () => {
    mockContract.createAgreement(mockContract.admin, 1n, 1000n, 2000n, 1001n, 2000n, 50n);
    mockContract.acceptAgreement("ST3NB...", 1n);
    mockContract.blockHeight = 2001n;
    const result = mockContract.terminateAgreement("ST3NB...", 1n);
    expect(result).toEqual({ value: true });
    const agreementResult = mockContract.getAgreement(1n);
    expect("value" in agreementResult).toBe(true);
    if ("value" in agreementResult) {
      expect(agreementResult.value.status).toBe(2);
    }
  });

  it("should allow initiating dispute", () => {
    mockContract.createAgreement(mockContract.admin, 1n, 1000n, 2000n, 1001n, 2000n, 50n);
    mockContract.acceptAgreement("ST3NB...", 1n);
    const result = mockContract.initiateDispute("ST3NB...", 1n);
    expect(result).toEqual({ value: true });
    const agreementResult = mockContract.getAgreement(1n);
    expect("value" in agreementResult).toBe(true);
    if ("value" in agreementResult) {
      expect(agreementResult.value.status).toBe(3);
    }
  });

  it("should prevent non-authorized users from initiating dispute", () => {
    mockContract.createAgreement(mockContract.admin, 1n, 1000n, 2000n, 1001n, 2000n, 50n);
    mockContract.acceptAgreement("ST3NB...", 1n);
    const result = mockContract.initiateDispute("ST4PF...", 1n);
    expect(result).toEqual({ error: 100 });
  });
});