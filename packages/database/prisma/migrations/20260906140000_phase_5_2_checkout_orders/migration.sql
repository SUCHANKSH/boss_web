CREATE TABLE "CheckoutOperation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckoutOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CheckoutOperation_orderId_key" ON "CheckoutOperation"("orderId");
CREATE UNIQUE INDEX "CheckoutOperation_userId_idempotencyKey_key" ON "CheckoutOperation"("userId", "idempotencyKey");
ALTER TABLE "CheckoutOperation" ADD CONSTRAINT "CheckoutOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckoutOperation" ADD CONSTRAINT "CheckoutOperation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
