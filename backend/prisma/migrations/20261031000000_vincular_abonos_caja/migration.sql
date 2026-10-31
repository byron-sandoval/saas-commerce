-- Los abonos anteriores conservan NULL: no se puede deducir su caja con certeza.
ALTER TABLE "Abono" ADD COLUMN "sesionCajaId" TEXT;

CREATE INDEX "Abono_empresaId_sesionCajaId_metodoPago_idx"
ON "Abono"("empresaId", "sesionCajaId", "metodoPago");

ALTER TABLE "Abono" ADD CONSTRAINT "Abono_empresaId_sesionCajaId_fkey"
FOREIGN KEY ("empresaId", "sesionCajaId") REFERENCES "SesionCaja"("empresaId", "id")
ON DELETE RESTRICT ON UPDATE NO ACTION;
