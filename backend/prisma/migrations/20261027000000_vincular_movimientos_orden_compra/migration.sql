ALTER TABLE "MovimientoAlmacen" ADD COLUMN "ordenCompraId" TEXT;

CREATE INDEX "MovimientoAlmacen_empresaId_ordenCompraId_idx"
ON "MovimientoAlmacen"("empresaId", "ordenCompraId");

ALTER TABLE "MovimientoAlmacen"
ADD CONSTRAINT "MovimientoAlmacen_empresaId_ordenCompraId_fkey"
FOREIGN KEY ("empresaId", "ordenCompraId")
REFERENCES "OrdenCompra"("empresaId", "id")
ON DELETE RESTRICT ON UPDATE NO ACTION;
