import { describe, expect, it } from "vitest";

import {
  createdUserSchema,
  createUserFormSchema,
  passwordResetResultSchema,
  resetPasswordFormSchema,
  updateUserFormSchema,
  userDtoSchema,
  userPageSchema,
} from "./schemas";
import { userFixture, userPage } from "./__fixtures__/users";

const valid = {
  username: "lan.nguyen",
  email: "lan@stockflow.vn",
  fullName: "",
  password: "",
  roles: ["ROLE_A"],
  warehouseIds: [],
};

describe("userDtoSchema (BE UserResponse)", () => {
  it("parses a full response", () => {
    expect(userDtoSchema.parse(userFixture())).toMatchObject({ status: "ACTIVE", version: 4 });
  });

  it("tolerates fields the backend omits (non_null inclusion) and defaults the lists", () => {
    const parsed = userDtoSchema.parse({
      userId: "u1",
      username: "a.b",
      email: "a@b.vn",
      status: "LOCKED",
      version: 0,
    });
    expect(parsed.roles).toEqual([]);
    expect(parsed.warehouseIds).toEqual([]);
    expect(parsed.mustChangePassword).toBe(false);
    expect(parsed.lastLoginAt).toBeUndefined();
  });

  it("rejects a status the backend does not define", () => {
    expect(userDtoSchema.safeParse({ ...userFixture(), status: "SLEEPING" }).success).toBe(false);
  });

  it("parses the paged envelope", () => {
    expect(userPageSchema.parse(userPage()).items).toHaveLength(1);
  });

  it("parses created user with and without a generated password", () => {
    expect(
      createdUserSchema.parse({ user: userFixture(), temporaryPassword: "Abc123xyz9" })
        .temporaryPassword,
    ).toBe("Abc123xyz9");
    expect(createdUserSchema.parse({ user: userFixture() }).temporaryPassword).toBeUndefined();
    expect(passwordResetResultSchema.parse({ sessionsEnded: 2 }).sessionsEnded).toBe(2);
  });
});

describe("createUserFormSchema mirrors BE CreateUserRequest", () => {
  it("accepts a minimal valid form (password left blank → BE generates one)", () => {
    expect(createUserFormSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["ab", "has space", "tên.có.dấu", "a".repeat(101)])("rejects username %j", (username) => {
    expect(createUserFormSchema.safeParse({ ...valid, username }).success).toBe(false);
  });

  it.each(["a.b-c_d", "abc", "A".repeat(100)])("accepts username %j", (username) => {
    expect(createUserFormSchema.safeParse({ ...valid, username }).success).toBe(true);
  });

  it.each(["", "no-at-sign", "has space@x.vn"])("rejects email %j", (email) => {
    expect(createUserFormSchema.safeParse({ ...valid, email }).success).toBe(false);
  });

  it("limits full name to 200 characters", () => {
    expect(createUserFormSchema.safeParse({ ...valid, fullName: "x".repeat(201) }).success).toBe(
      false,
    );
  });

  it("requires at least one role and at most 20", () => {
    expect(createUserFormSchema.safeParse({ ...valid, roles: [] }).success).toBe(false);
    const many = Array.from({ length: 21 }, (_, i) => `R${i}`);
    expect(createUserFormSchema.safeParse({ ...valid, roles: many }).success).toBe(false);
  });

  it("limits warehouses to 50", () => {
    const many = Array.from({ length: 51 }, (_, i) => `W${i}`);
    expect(createUserFormSchema.safeParse({ ...valid, warehouseIds: many }).success).toBe(false);
  });

  it.each([
    ["Short1a", false],
    ["alllowercase123", false],
    ["ALLUPPERCASE123", false],
    ["NoDigitsHereAtAll", false],
    ["Abcdefghi1", true],
    [`Aa1${"x".repeat(69)}`, true],
    [`Aa1${"x".repeat(70)}`, false],
  ])("password %j valid=%s (10-72 chars, upper + lower + digit)", (password, ok) => {
    expect(createUserFormSchema.safeParse({ ...valid, password }).success).toBe(ok);
  });
});

describe("other forms", () => {
  it("update form requires an email and bounds the name", () => {
    expect(updateUserFormSchema.safeParse({ email: "", fullName: "" }).success).toBe(false);
    expect(updateUserFormSchema.safeParse({ email: "a@b.vn", fullName: "Lan" }).success).toBe(true);
  });

  it("reset form accepts blank (generate) or a policy-compliant password", () => {
    expect(resetPasswordFormSchema.safeParse({ newPassword: "" }).success).toBe(true);
    expect(resetPasswordFormSchema.safeParse({ newPassword: "weak" }).success).toBe(false);
    expect(resetPasswordFormSchema.safeParse({ newPassword: "Abcdefghi1" }).success).toBe(true);
  });
});
