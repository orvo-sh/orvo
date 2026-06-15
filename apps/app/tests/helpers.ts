import { getDb } from "@repo/db";

const db = getDb(process.env.POSTGRES_URL!);

export const getOtpFromDb = async (email: string) => {
  const record = await db.query.verification.findFirst({
    where: ({ identifier }, { like }) =>
      like(identifier, `%email-verification-otp-${email}`),
  });
  return record?.value?.split(":")[0] ?? null;
};

export const waitForOtp = async (email: string) => {
  let otp: string | null = null;
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    otp = await getOtpFromDb(email);
    if (otp && otp.length === 6) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  return otp;
};
