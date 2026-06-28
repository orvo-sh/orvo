import type { DB } from "@repo/db";

const findVerificationOtp = async (db: DB, email: string) => {
  const record = await db.query.verification.findFirst({
    where: ({ identifier }, { like }) =>
      like(identifier, `%email-verification-otp-${email}`),
  });
  return record?.value?.split(":")[0] ?? null;
};

const waitForVerificationOtp = async (db: DB, email: string) => {
  let otp: string | null = null;
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    otp = await findVerificationOtp(db, email);
    if (otp && otp.length === 6) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return otp;
};

export { findVerificationOtp, waitForVerificationOtp };
