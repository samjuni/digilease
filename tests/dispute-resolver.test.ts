import { describe, it, expect, beforeEach } from "vitest";

interface Dispute {
  agreementId: bigint;
  initiator: string;
  status: number;
  createdAt: bigint;
  votingEndsAt: bigint | null;
  landlordVotes: bigint;
  tenantVotes: bigint;
  resolution: boolean | null;
}

interface MockContract {
  admin: string;
  rentalAgreement: string;
  escrowVault: string;
  minStake: bigint;
  votingPeriod: bigint;
  disputes: Map<bigint, Dispute>;
  arbitrators: Map<string, { stake: bigint }>;
  votes: Map<string, boolean>;
  disputeCounter: Map<string, bigint>;
  blockHeight: bigint;
  isAdmin(caller: string): boolean;
  setRentalAgreement(caller: string, contract: string): { value: boolean } | { error: number };
  setEscrowVault(caller: string, contract: string): { value: boolean } | { error: number };
  setMinStake(caller: string, amount: bigint): { value: boolean } | { error: number };
  setVotingPeriod(caller: string, blocks: bigint): { value: boolean } | { error: number };
  stakeArbitrator(caller: string, amount: bigint): { value: boolean } | { error: number };
  unstakeArbitrator(caller: string, amount: bigint): { value: boolean } | { error: number };
  initiateDispute(caller: string, agreementId: bigint): { value: bigint } | { error: number };
  startVoting(caller: string, disputeId: bigint): { value: boolean } | { error: number };
  vote(caller: string, disputeId: bigint, voteForLandlord: boolean): { value: boolean } | { error: number };
  resolveDispute(caller: string, disputeId: bigint): { value: boolean } | { error: number };
  cancelDispute(caller: string, disputeId: bigint): { value: boolean } | { error: number };
  getDispute(disputeId: bigint): { value: Dispute } | { error: number };
  getArbitratorStake(user: string): { value: bigint };
  getVote(disputeId: bigint, voter: string): { value: boolean | undefined };
  getDisputeCount(initiator: string): { value: bigint };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  rentalAgreement: "ST2CY5...",
  escrowVault: "ST3NB...",
  minStake: 1000n,
  votingPeriod: 1440n,
  disputes: new Map(),
  arbitrators: new Map(),
  votes: new Map(),
  disputeCounter: new Map(),
  blockHeight: 1000n,
  isAdmin(caller: string) {
    return caller === this.admin;
  },
  setRentalAgreement(caller: string, contract: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (contract === "SP000000000000000000002Q6VF78") return { error: 105 };
    this.rentalAgreement = contract;
    return { value: true };
  },
  setEscrowVault(caller: string, contract: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (contract === "SP000000000000000000002Q6VF78") return { error: 105 };
    this.escrowVault = contract;
    return { value: true };
  },
  setMinStake(caller: string, amount: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (amount <= 0n) return { error: 106 };
    this.minStake = amount;
    return { value: true };
  },
  setVotingPeriod(caller: string, blocks: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (blocks <= 0n) return { error: 106 };
    this.votingPeriod = blocks;
    return { value: true };
  },
  stakeArbitrator(caller: string, amount: bigint) {
    if (amount <= this.minStake) return { error: 106 };
    const currentStake = this.arbitrators.get(caller)?.stake || 0n;
    this.arbitrators.set(caller, { stake: currentStake + amount });
    return { value: true };
  },
  unstakeArbitrator(caller: string, amount: bigint) {
    const currentStake = this.arbitrators.get(caller)?.stake || 0n;
    if (currentStake < amount) return { error: 108 };
    if (currentStake === amount) return { error: 106 };
    this.arbitrators.set(caller, { stake: currentStake - amount });
    return { value: true };
  },
  initiateDispute(caller: string, agreementId: bigint) {
    if (agreementId === 0n || (caller !== "ST4PF..." && caller !== "ST5QR...")) return { error: 101 };
    const disputeId = ((this.disputeCounter.get(caller) || 0n) + 1n);
    if (this.disputes.has(disputeId)) return { error: 101 };
    this.disputes.set(disputeId, {
      agreementId,
      initiator: caller,
      status: 0,
      createdAt: this.blockHeight,
      votingEndsAt: null,
      landlordVotes: 0n,
      tenantVotes: 0n,
      resolution: null
    });
    this.disputeCounter.set(caller, disputeId);
    return { value: disputeId };
  },
  startVoting(caller: string, disputeId: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    const dispute = this.disputes.get(disputeId);
    if (!dispute) return { error: 102 };
    if (dispute.status !== 0) return { error: 107 };
    dispute.status = 1;
    dispute.votingEndsAt = this.blockHeight + this.votingPeriod;
    this.disputes.set(disputeId, dispute);
    return { value: true };
  },
  vote(caller: string, disputeId: bigint, voteForLandlord: boolean) {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) return { error: 102 };
    if (dispute.status !== 1 || !dispute.votingEndsAt || this.blockHeight > dispute.votingEndsAt) return { error: 104 };
    if ((this.arbitrators.get(caller)?.stake || 0n) < this.minStake) return { error: 100 };
    const voteKey = `${disputeId}-${caller}`;
    if (this.votes.has(voteKey)) return { error: 103 };
    this.votes.set(voteKey, voteForLandlord);
    dispute.landlordVotes = voteForLandlord ? dispute.landlordVotes + 1n : dispute.landlordVotes;
    dispute.tenantVotes = !voteForLandlord ? dispute.tenantVotes + 1n : dispute.tenantVotes;
    this.disputes.set(disputeId, dispute);
    return { value: true };
  },
  resolveDispute(caller: string, disputeId: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    const dispute = this.disputes.get(disputeId);
    if (!dispute) return { error: 102 };
    if (dispute.status !== 1 || !dispute.votingEndsAt || this.blockHeight <= dispute.votingEndsAt) return { error: 107 };
    dispute.status = 2;
    dispute.resolution = dispute.landlordVotes >= dispute.tenantVotes;
    this.disputes.set(disputeId, dispute);
    return { value: true };
  },
  cancelDispute(caller: string, disputeId: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    const dispute = this.disputes.get(disputeId);
    if (!dispute) return { error: 102 };
    if (dispute.status !== 0) return { error: 107 };
    dispute.status = 3;
    this.disputes.set(disputeId, dispute);
    return { value: true };
  },
  getDispute(disputeId: bigint) {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) return { error: 102 };
    return { value: dispute };
  },
  getArbitratorStake(user: string) {
    return { value: this.arbitrators.get(user)?.stake || 0n };
  },
  getVote(disputeId: bigint, voter: string) {
    return { value: this.votes.get(`${disputeId}-${voter}`) };
  },
  getDisputeCount(initiator: string) {
    return { value: this.disputeCounter.get(initiator) || 0n };
  }
};

describe("DisputeResolver Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.rentalAgreement = "ST2CY5...";
    mockContract.escrowVault = "ST3NB...";
    mockContract.minStake = 1000n;
    mockContract.votingPeriod = 1440n;
    mockContract.disputes = new Map();
    mockContract.arbitrators = new Map();
    mockContract.votes = new Map();
    mockContract.disputeCounter = new Map();
    mockContract.blockHeight = 1000n;
  });

  it("should allow admin to set rental agreement contract", () => {
    const result = mockContract.setRentalAgreement(mockContract.admin, "ST4PF...");
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      expect(mockContract.rentalAgreement).toBe("ST4PF...");
    }
  });

  it("should allow admin to set escrow vault contract", () => {
    const result = mockContract.setEscrowVault(mockContract.admin, "ST5QR...");
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      expect(mockContract.escrowVault).toBe("ST5QR...");
    }
  });

  it("should allow admin to set minimum stake", () => {
    const result = mockContract.setMinStake(mockContract.admin, 2000n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      expect(mockContract.minStake).toBe(2000n);
    }
  });

  it("should allow admin to set voting period", () => {
    const result = mockContract.setVotingPeriod(mockContract.admin, 2880n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      expect(mockContract.votingPeriod).toBe(2880n);
    }
  });

  it("should allow staking as arbitrator", () => {
    const result = mockContract.stakeArbitrator("ST4PF...", 2000n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const stake = mockContract.getArbitratorStake("ST4PF...").value;
      expect(stake).toBe(2000n);
    }
  });

  it("should allow unstaking as arbitrator", () => {
    mockContract.stakeArbitrator("ST4PF...", 2000n);
    const result = mockContract.unstakeArbitrator("ST4PF...", 1000n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const stake = mockContract.getArbitratorStake("ST4PF...").value;
      expect(stake).toBe(1000n);
    }
  });

  it("should allow initiating a dispute", () => {
    const result = mockContract.initiateDispute("ST4PF...", 1n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(1n);
      const disputeResult = mockContract.getDispute(1n);
      expect("value" in disputeResult).toBe(true);
      if ("value" in disputeResult) {
        expect(disputeResult.value).toEqual({
          agreementId: 1n,
          initiator: "ST4PF...",
          status: 0,
          createdAt: 1000n,
          votingEndsAt: null,
          landlordVotes: 0n,
          tenantVotes: 0n,
          resolution: null
        });
      }
    }
  });

  it("should allow admin to start voting", () => {
    mockContract.initiateDispute("ST4PF...", 1n);
    const result = mockContract.startVoting(mockContract.admin, 1n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const disputeResult = mockContract.getDispute(1n);
      expect("value" in disputeResult).toBe(true);
      if ("value" in disputeResult) {
        expect(disputeResult.value.status).toBe(1);
        expect(disputeResult.value.votingEndsAt).toBe(1000n + 1440n);
      }
    }
  });

  it("should allow arbitrator to vote", () => {
    mockContract.stakeArbitrator("ST6RS...", 2000n);
    mockContract.initiateDispute("ST4PF...", 1n);
    mockContract.startVoting(mockContract.admin, 1n);
    const result = mockContract.vote("ST6RS...", 1n, true);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const disputeResult = mockContract.getDispute(1n);
      expect("value" in disputeResult).toBe(true);
      if ("value" in disputeResult) {
        expect(disputeResult.value.landlordVotes).toBe(1n);
        expect(mockContract.getVote(1n, "ST6RS...").value).toBe(true);
      }
    }
  });

  it("should allow admin to resolve dispute", () => {
    mockContract.stakeArbitrator("ST6RS...", 2000n);
    mockContract.initiateDispute("ST4PF...", 1n);
    mockContract.startVoting(mockContract.admin, 1n);
    mockContract.vote("ST6RS...", 1n, true);
    mockContract.blockHeight = 2441n;
    const result = mockContract.resolveDispute(mockContract.admin, 1n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const disputeResult = mockContract.getDispute(1n);
      expect("value" in disputeResult).toBe(true);
      if ("value" in disputeResult) {
        expect(disputeResult.value.status).toBe(2);
        expect(disputeResult.value.resolution).toBe(true);
      }
    }
  });

  it("should allow admin to cancel dispute", () => {
    mockContract.initiateDispute("ST4PF...", 1n);
    const result = mockContract.cancelDispute(mockContract.admin, 1n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const disputeResult = mockContract.getDispute(1n);
      expect("value" in disputeResult).toBe(true);
      if ("value" in disputeResult) {
        expect(disputeResult.value.status).toBe(3);
      }
    }
  });

  it("should prevent non-arbitrator from voting", () => {
    mockContract.initiateDispute("ST4PF...", 1n);
    mockContract.startVoting(mockContract.admin, 1n);
    const result = mockContract.vote("ST7ST...", 1n, true);
    expect(result).toEqual({ error: 100 });
  });

  it("should prevent voting after voting period", () => {
    mockContract.stakeArbitrator("ST6RS...", 2000n);
    mockContract.initiateDispute("ST4PF...", 1n);
    mockContract.startVoting(mockContract.admin, 1n);
    mockContract.blockHeight = 2441n;
    const result = mockContract.vote("ST6RS...", 1n, true);
    expect(result).toEqual({ error: 104 });
  });

  it("should prevent starting voting for non-existent dispute", () => {
    const result = mockContract.startVoting(mockContract.admin, 999n);
    expect(result).toEqual({ error: 102 });
  });

  it("should prevent resolving non-existent dispute", () => {
    const result = mockContract.resolveDispute(mockContract.admin, 999n);
    expect(result).toEqual({ error: 102 });
  });

  it("should prevent cancelling non-existent dispute", () => {
    const result = mockContract.cancelDispute(mockContract.admin, 999n);
    expect(result).toEqual({ error: 102 });
  });
});