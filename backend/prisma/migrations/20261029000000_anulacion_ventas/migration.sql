ALTER TYPE "TipoMovimiento" ADD VALUE 'ANULACION_VENTA';

ALTER TABLE "Venta"
ADD COLUMN "anuladaPorId" TEXT,
ADD COLUMN "anuladaEn" TIMESTAMP(3),
ADD COLUMN "motivoAnulacion" VARCHAR(500);

ALTER TABLE "Venta"
ADD CONSTRAINT "Venta_empresaId_anuladaPorId_fkey"
FOREIGN KEY ("empresaId", "anuladaPorId")
REFERENCES "Usuario"("empresaId", "id")
ON DELETE RESTRICT ON UPDATE NO ACTION;
