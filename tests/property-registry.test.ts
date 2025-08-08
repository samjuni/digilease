import { describe, it, expect, beforeEach } from "vitest";

interface Property {
  owner: string;
  address: string;
  description: string;
  status: number;
  registeredAt: bigint;
  verifiedAt: bigint | null;
}

interface MockContract {
  admin: string;
  verificationFee: bigint;
  properties: Map<bigint, Property>;
  propertyCounter: Map<string, bigint>;
  blockHeight: bigint;
  isAdmin(caller: string): boolean;
  setVerificationFee(caller: string, fee: bigint): { value: boolean } | { error: number };
  transferAdmin(caller: string, newAdmin: string): { value: boolean } | { error: number };
  registerProperty(caller: string, address: string, description: string): { value: bigint } | { error: number };
  verifyProperty(caller: string, propertyId: bigint): { value: boolean } | { error: number };
  suspendProperty(caller: string, propertyId: bigint): { value: boolean } | { error: number };
  transferProperty(caller: string, propertyId: bigint, newOwner: string): { value: boolean } | { error: number };
  updatePropertyDetails(caller: string, propertyId: bigint, address: string, description: string): { value: boolean } | { error: number };
  getProperty(propertyId: bigint): { value: Property } | { error: number };
  getPropertyCount(owner: string): { value: bigint };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  verificationFee: 1000n,
  properties: new Map(),
  propertyCounter: new Map(),
  blockHeight: 1000n,
  isAdmin(caller: string) {
    return caller === this.admin;
  },
  setVerificationFee(caller: string, fee: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (fee <= 0n) return { error: 103 };
    this.verificationFee = fee;
    return { value: true };
  },
  transferAdmin(caller: string, newAdmin: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newAdmin === "SP000000000000000000002Q6VF78") return { error: 104 };
    this.admin = newAdmin;
    return { value: true };
  },
  registerProperty(caller: string, address: string, description: string) {
    const propertyId = ((this.propertyCounter.get(caller) || 0n) + 1n);
    if (this.properties.has(propertyId)) return { error: 101 };
    this.properties.set(propertyId, {
      owner: caller,
      address,
      description,
      status: 0,
      registeredAt: this.blockHeight,
      verifiedAt: null
    });
    this.propertyCounter.set(caller, propertyId);
    return { value: propertyId };
  },
  verifyProperty(caller: string, propertyId: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    const property = this.properties.get(propertyId);
    if (!property) return { error: 102 };
    if (property.status !== 0) return { error: 105 };
    property.status = 1;
    property.verifiedAt = this.blockHeight;
    this.properties.set(propertyId, property);
    return { value: true };
  },
  suspendProperty(caller: string, propertyId: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    const property = this.properties.get(propertyId);
    if (!property) return { error: 102 };
    if (property.status !== 1) return { error: 105 };
    property.status = 2;
    this.properties.set(propertyId, property);
    return { value: true };
  },
  transferProperty(caller: string, propertyId: bigint, newOwner: string) {
    const property = this.properties.get(propertyId);
    if (!property) return { error: 102 };
    if (property.owner !== caller) return { error: 100 };
    if (newOwner === "SP000000000000000000002Q6VF78") return { error: 104 };
    if (property.status !== 1) return { error: 105 };
    property.owner = newOwner;
    this.properties.set(propertyId, property);
    return { value: true };
  },
  updatePropertyDetails(caller: string, propertyId: bigint, address: string, description: string) {
    const property = this.properties.get(propertyId);
    if (!property) return { error: 102 };
    if (property.owner !== caller) return { error: 100 };
    if (property.status !== 1) return { error: 105 };
    property.address = address;
    property.description = description;
    property.status = 0;
    property.verifiedAt = null;
    this.properties.set(propertyId, property);
    return { value: true };
  },
  getProperty(propertyId: bigint) {
    const property = this.properties.get(propertyId);
    if (!property) return { error: 102 };
    return { value: property };
  },
  getPropertyCount(owner: string) {
    return { value: this.propertyCounter.get(owner) || 0n };
  }
};

describe("PropertyRegistry Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.verificationFee = 1000n;
    mockContract.properties = new Map();
    mockContract.propertyCounter = new Map();
    mockContract.blockHeight = 1000n;
  });

  it("should allow admin to set verification fee", () => {
    const result = mockContract.setVerificationFee(mockContract.admin, 2000n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      expect(mockContract.verificationFee).toBe(2000n);
    }
  });

  it("should allow admin to transfer admin rights", () => {
    const result = mockContract.transferAdmin(mockContract.admin, "ST3NB...");
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      expect(mockContract.admin).toBe("ST3NB...");
    }
  });

  it("should allow registering a property", () => {
    const result = mockContract.registerProperty("ST3NB...", "123 Main St", "2-bedroom apartment");
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(1n);
      const propertyResult = mockContract.getProperty(1n);
      expect("value" in propertyResult).toBe(true);
      if ("value" in propertyResult) {
        expect(propertyResult.value).toEqual({
          owner: "ST3NB...",
          address: "123 Main St",
          description: "2-bedroom apartment",
          status: 0,
          registeredAt: 1000n,
          verifiedAt: null
        });
      }
    }
  });

  it("should allow admin to verify a property", () => {
    mockContract.registerProperty("ST3NB...", "123 Main St", "2-bedroom apartment");
    const result = mockContract.verifyProperty(mockContract.admin, 1n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const propertyResult = mockContract.getProperty(1n);
      expect("value" in propertyResult).toBe(true);
      if ("value" in propertyResult) {
        expect(propertyResult.value.status).toBe(1);
        expect(propertyResult.value.verifiedAt).toBe(1000n);
      }
    }
  });

  it("should allow admin to suspend a verified property", () => {
    mockContract.registerProperty("ST3NB...", "123 Main St", "2-bedroom apartment");
    mockContract.verifyProperty(mockContract.admin, 1n);
    const result = mockContract.suspendProperty(mockContract.admin, 1n);
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const propertyResult = mockContract.getProperty(1n);
      expect("value" in propertyResult).toBe(true);
      if ("value" in propertyResult) {
        expect(propertyResult.value.status).toBe(2);
      }
    }
  });

  it("should allow owner to transfer property", () => {
    mockContract.registerProperty("ST3NB...", "123 Main St", "2-bedroom apartment");
    mockContract.verifyProperty(mockContract.admin, 1n);
    const result = mockContract.transferProperty("ST3NB...", 1n, "ST4PF...");
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const propertyResult = mockContract.getProperty(1n);
      expect("value" in propertyResult).toBe(true);
      if ("value" in propertyResult) {
        expect(propertyResult.value.owner).toBe("ST4PF...");
      }
    }
  });

  it("should allow owner to update property details", () => {
    mockContract.registerProperty("ST3NB...", "123 Main St", "2-bedroom apartment");
    mockContract.verifyProperty(mockContract.admin, 1n);
    const result = mockContract.updatePropertyDetails("ST3NB...", 1n, "456 Oak St", "3-bedroom house");
    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(true);
      const propertyResult = mockContract.getProperty(1n);
      expect("value" in propertyResult).toBe(true);
      if ("value" in propertyResult) {
        expect(propertyResult.value).toEqual({
          owner: "ST3NB...",
          address: "456 Oak St",
          description: "3-bedroom house",
          status: 0,
          registeredAt: 1000n,
          verifiedAt: null
        });
      }
    }
  });

  it("should prevent non-owner from transferring property", () => {
    mockContract.registerProperty("ST3NB...", "123 Main St", "2-bedroom apartment");
    mockContract.verifyProperty(mockContract.admin, 1n);
    const result = mockContract.transferProperty("ST4PF...", 1n, "ST5QR...");
    expect(result).toEqual({ error: 100 });
  });

  it("should prevent non-admin from verifying property", () => {
    mockContract.registerProperty("ST3NB...", "123 Main St", "2-bedroom apartment");
    const result = mockContract.verifyProperty("ST4PF...", 1n);
    expect(result).toEqual({ error: 100 });
  });
});