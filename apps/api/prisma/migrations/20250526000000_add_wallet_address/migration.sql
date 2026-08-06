-- AddColumn: wallet_address para ciudadanos con billetera Polygon conectada
ALTER TABLE "citizens" ADD COLUMN "wallet_address" TEXT;
ALTER TABLE "citizens" ADD COLUMN "sbt_token_id" TEXT;

-- Unique index: una wallet por ciudadano (previene que alguien reclame wallets ajenas)
CREATE UNIQUE INDEX "citizens_wallet_address_key" ON "citizens"("wallet_address");
